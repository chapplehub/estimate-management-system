# EC2 公開デモ環境への通常デプロイ

公開デモ環境（`chapple-esm.duckdns.org`）に、main へマージされた変更を反映する手順（Issue #784）。
方式の判断理由は [ADR-20260829-9f1](../adr/20260829-9f1-pin-ec2-release-to-head-commit-derive-image-tag.md) を参照。

以降のコマンドは、EC2 上のリポジトリ直下（`compose.prod.yaml` と `.env.production` がある場所）で実行する前提。

> [!IMPORTANT]
> **EC2 で動いているものは、クローンの HEAD commit で一意に決まる。** 手順・スクリプト・運用ルールはすべてこの一点を守るためにある。
> EC2 上で追跡ファイルを直接編集してはならない（6 章）。

## 1. EC2 上のクローンの役割

EC2 にはリポジトリのクローンが丸ごと置かれているが、**アプリのコードはそこからは一切使われない**。アプリは GHCR のイメージだけから動いており、イメージには `.next/standalone` + `static` + `public` しか入っていない（`Dockerfile` の runner ステージ）。EC2 には `node_modules` すら存在しない。

クローンが運んでいるのは**起動の宣言**だけである。実際に使われるファイルは 3 つ。

| パス | 用途 | 更新経路 |
| --- | --- | --- |
| `compose.prod.yaml` | `docker compose -f` で読む | git |
| `docker/nginx/conf.d/*.conf` | bind mount で nginx コンテナへ | git |
| `.env.production` | `--env-file` で読む秘密（`DATABASE_URL` / `BETTER_AUTH_SECRET` 等） | 手動配置。git 管理外 |
| 上記以外（`src/` / `prisma/` / `Dockerfile` / `package.json` …） | **使わない。置いてあるだけ** | — |

`src/` の任意のファイルを EC2 上で書き換えて `up -d` しても何も起きない（compose の定義もイメージ ID も変わらないため、コンテナは再作成すらされない）。

この文書で使う言葉:

| 用語 | 意味 |
| --- | --- |
| リリース | develop → main の PR マージ。main 上の 1 commit に対応し、`release-image.yml` がその commit のイメージをビルドする |
| デプロイ | リリース commit を EC2 に反映する作業。`scripts/deploy.sh` の 1 回の実行 |
| 起動の宣言 | `compose.prod.yaml` と `docker/nginx/conf.d/`。「何をどう起動するか」を git で運ぶ部分 |
| drift | クローンの HEAD と作業ツリーの差。追跡ファイルの編集も、未追跡ファイルの追加も drift |

クローンは**指定されたリリース commit に detach された、読み取り専用のチェックアウト**である。`git status` に `HEAD detached at …` と出るのが正常状態で、ブランチを追わない。

## 2. 届ける経路は 2 つ

変更は 2 つの経路で EC2 に届く。起点はどちらも main へのマージ。

```
                     ┌─ アプリの中身 ──────────────────────────────────────────┐
develop → main merge → Actions build → GHCR (latest / sha-xxxxxxx) → docker compose pull
                     └─────────────────────────────────────────────────────────┘

                     ┌─ 起動の宣言 ────────────────────────────────────────────┐
develop → main merge → （ビルド不要。ファイルそのもの）      → git checkout --detach
                     └─────────────────────────────────────────────────────────┘
```

2 経路を結び付けるキーが **commit の SHA** である。`release-image.yml` はイメージに `sha-<先頭 7 文字>` のタグを付け、EC2 側はクローンの HEAD から同じ 7 文字を計算してそのタグを pull する（`scripts/deploy-env.sh`）。だから `git checkout` と `docker compose pull` は必ずセットで、同じ commit に対して行う。片方だけだと宣言とイメージの世代がずれる。

`latest` タグも push されているが、EC2 の正規経路では使わない。`latest` は可変で「今どの commit が動いているか」を git から読めなくするため（ADR-20260829-9f1）。

### 2.1 release-image が担うもの

GitHub Actions でビルドして GHCR に置く（= EC2 でビルドさせない）こと自体が目的であり、次の 4 点を担う。詳細は [ADR-20260818-7pn](../adr/20260818-7pn-production-images-arm64-single-arch-bind-ec2-to-graviton.md) と #758 を参照。

1. **ビルドの重さの隔離**: `pnpm install` + `next build` は t4g では OOM リスクがある。EC2 上ビルドは不採用（#758）
2. **成果物の不変性**: `sha-<short>` タグで、過去に実際に動いていたバイト列そのものへ戻せる。「ビルドを再現する」と「成果物を取っておく」は別物
3. **arm64 ネイティブビルド**: public リポジトリの ARM ランナーは無料（ADR-20260818-7pn）
4. **リリース境界の定義**: `latest` = main の写像。main 以外の commit にはイメージが無く、EC2 に載せられない

## 3. 前提条件

- **対象 commit の Release Image ワークフローが完了している**（GitHub の Actions → Release Image が緑）。完了前にデプロイすると `pull` で止まる（8 章）
- `.env.production` は**秘密だけ**を書く。`APP_IMAGE` / `MIGRATE_IMAGE` を書かない（書くとスクリプトが導出した値を上書きし、HEAD とイメージがずれる。compose の優先順位はシェル環境変数 > `--env-file` > 既定値だが、`.env.production` に書くこと自体を禁じる）
- 実行ユーザーが `docker` グループに属し、`sudo` 無しで `docker compose` を実行できる（スクリプトは `sudo` を使わない）
- クローンから `git fetch origin` が通る

## 4. 通常デプロイ

```bash
scripts/deploy.sh              # origin/main の先頭へ（通常のリリース）
scripts/deploy.sh <commit>     # 指定 commit へ（ロールバックも同じコマンド。5 章）
```

`deploy.sh` は git フェーズを担い、最終行で適用フェーズ（`deploy-apply.sh`）へ `exec` する。各行は「失敗したら止まる」性質を持ち、`set -euo pipefail` により途中で失敗すれば後続は走らない。

| 段階 | 行 | 失敗する条件 | 失敗の意味 |
| --- | --- | --- | --- |
| git | `git status --porcelain` が非空なら `exit 1` | 追跡ファイルの編集・未追跡ファイルがある | **drift**。上書きも退避もしない（8 章） |
| git | `git fetch origin` | リモートに到達できない | ネットワーク／認証 |
| git | `git checkout --detach <ref>` | ref が存在しない | typo か fetch 漏れ |
| 適用 | `eval "$(scripts/deploy-env.sh)"` | — | HEAD から `APP_IMAGE` / `MIGRATE_IMAGE` を導出 |
| 適用 | `docker compose pull` | タグが GHCR に無い | Release Image 未完了、または main に含まれない commit（8 章） |
| 適用 | `up -d --remove-orphans --wait --wait-timeout 120` | app が 120 秒以内に healthy にならない | migrate 失敗（→ app が起動しない）か app の起動失敗（8 章） |
| 適用 | `exec -T nginx nginx -t` → `nginx -s reload` | conf の文法エラー | `conf.d` は bind mount で `up -d` では反映されないため、毎回 reload する |
| 適用 | `curl -fsS https://chapple-esm.duckdns.org/api/health` | 2xx 以外 | nginx → app の経路のどこかが壊れている |

正常終了時は最後に `deployed: <40 桁の SHA> (sha-xxxxxxx)` が出る。これが「EC2 で動いているもの」の記録になる。

`pull` は `up -d` の前に必ず走る。`up -d` は既にローカルにあるタグを再 pull しないため、`pull` 無しでは「デプロイしたつもり」で旧版が動き続ける。過去の暗黙ビルドが残した偽のローカルタグ（8 章）も、`pull` でしか正規のものに置き換わらない。

`--remove-orphans` は、compose ファイルから消えたサービスのコンテナを落とす（サービスの改廃がリリースに含まれる場合の後始末）。

### 4.1 git を触らずに再適用する

`.env.production` を変更した、コンテナを作り直したい、`deploy.sh` が適用フェーズで止まって原因を直した、といった場合は適用フェーズだけを実行する。

```bash
scripts/deploy-apply.sh
```

これは「現 HEAD をもう一度適用する」操作で、HEAD は動かない。手動で `docker compose ... up -d` を打つ代わりに、必ずこれを使う（6 章）。

### 4.2 移行（一回限り）

本手順を導入する前のクローンは `main` ブランチにいて `scripts/` を持たない。初回だけ手で detach してからスクリプトを実行する。一度きりの作業だが、`tls-certificates.md` 2 章と同じく証跡として残す。

```bash
# 1. drift が無いことを確認する（何か出たら 8 章の手順で解消してから進む）
git status --porcelain

# 2. スクリプトを含む main の先頭を取得し、detach する
git fetch origin
git checkout --detach origin/main

# 3. 以降は通常手順
scripts/deploy.sh
```

初回はイメージの参照が `latest` から `sha-xxxxxxx` に変わるため、中身が同じでも app / migrate のコンテナは再作成される（migrate は再実行されるが適用済みなら何もしない。app は数秒の再起動を伴う）。2 回目以降は変更のあったサービスだけが再作成される。

## 5. ロールバック

```bash
scripts/deploy.sh <戻したい commit>
```

通常デプロイと同じコマンドで、ref に旧リリースの commit を渡すだけ。`.env.production` は触らない。戻したい commit は `git log --oneline origin/main` か、GitHub の main のコミット一覧（develop → main のマージコミット）から探す。

> [!IMPORTANT]
> **戻るのはイメージと起動の宣言だけで、DB スキーマは戻らない。** `migrate` は `prisma migrate deploy` で前進しかしない。
> ロールバックを 3 段で考える。

### 5.1 マイグレーションを跨がない場合 — そのまま戻す

まず、戻したい commit と現 HEAD の間にマイグレーションの差が無いことを確認する。

```bash
git diff --stat <戻したい commit> HEAD -- prisma/migrations/
```

**出力が空**なら DB スキーマは同じであり、`scripts/deploy.sh <戻したい commit>` で戻せる。

### 5.2 マイグレーションを跨ぐ場合 — 作り直す

5.1 の出力が空でない場合、旧イメージは新しいスキーマを知らず、そのまま戻すと動作が保証されない。デモ環境（[ADR-20260821-4f1](../adr/20260821-4f1-deploy-target-is-public-demo-reuse-dev-seed.md)）であり保全すべきデータは無いので、**DB を捨てて作り直す**。

```bash
# 1. コンテナと DB ボリューム（pgdata）を削除する。証明書（/etc/letsencrypt）はホスト側にあり消えない
docker compose -f compose.prod.yaml --env-file .env.production down -v

# 2. 戻したい commit をデプロイする（空の DB に、その commit のマイグレーションが適用される）
scripts/deploy.sh <戻したい commit>

# 3. 初期データを投入する（docs/ops/demo-seed.md の手順どおり。eval "$(scripts/deploy-env.sh)" を忘れない）
```

`prisma migrate resolve` で個別に巻き戻す手順は書かない。実業務データを持つ環境になった時点で、別の runbook が要る。

### 5.3 migrate が失敗した場合 — 同じく作り直す

デプロイ中に `migrate` が失敗すると `app` は起動せず、`up --wait` がタイムアウトで止まる。マイグレーションが途中まで適用された状態の修復も 5.2 と同じ「作り直し」で行う。`down -v` → `scripts/deploy.sh <動いていた commit>`（原因を直したリリースがあればそれ）→ seed。

## 6. 運用ルール

- **EC2 上で追跡ファイルを直接編集しない。** 設定変更は必ず develop → main を経由する。ちょっとした nginx の調整も例外にしない。直接編集した状態は drift であり、次のデプロイは止まる
- **HEAD が「動いているもの」。** 何が動いているか知りたければ `git rev-parse HEAD`（または直近の `deployed:` 出力）を見る。EC2 に聞く必要は無い
- **detached HEAD が正常状態。** `git checkout main` 等でブランチに戻さない。戻すと `git pull` が使えてしまい、「動いているものが git から決まる」が崩れる
- **`up -d` は `scripts/deploy-apply.sh` 経由のみ。** 手で `docker compose ... up -d` を打たない。変数未設定の `up -d` は `latest` に解決し、HEAD とイメージの世代がずれる。手動で打ってよい compose コマンドは読み取り系と停止・再開（`logs` / `ps` / `exec` / `stop` / `start`）。イメージを解決するコマンド（`run` / `create` / `pull`）を手で打つ場合は、必ず `eval "$(scripts/deploy-env.sh)"` を前置する（`demo-seed.md` はこの形になっている）
- **`.env.production` に `*_IMAGE` を書かない**（3 章）

### 6.1 sparse-checkout で配置ファイルを絞らない

「使うファイルは 3 つなのだから、クローンを `compose.prod.yaml` と `docker/nginx/conf.d/` に絞れば誤読が消える」という案は検討したうえで採らない。

1. **実害は #761 で消えている。** ソースが置いてあることの実害は `build:` 併記による暗黙の EC2 上ビルドだったが、`build:` は削除済み。残るのは「ビルドされるのでは」という認知上の誤読だけで、それは本文書の 1 章で解消する
2. **cone mode ではルート直下を消せない。** git の sparse-checkout（cone mode）はディレクトリ単位の指定で、ルート直下のファイル（`Dockerfile` / `package.json` / `pnpm-lock.yaml` …）は常に展開される。「ソースが無いように見える」効果が中途半端に終わる
3. **git 外の状態を作る。** 絞り込みの指定は `.git/info/sparse-checkout` にあり、commit に含まれない。「動いているものが git から決まる」の例外がひとつ増え、加えてパス一覧とリポジトリのレイアウトが結合する（レイアウト変更のたびに EC2 側の設定を手で直す必要が生じる）

### 6.2 スクリプト化の判断

`tls-certificates.md` 3 章では初回発行を「スクリプト化しない」と判断したが、デプロイは逆にスクリプト化する。判断が分かれるのは頻度の差で、初回発行は環境の作り直し時にしか走らないのに対し、デプロイは毎リリース走る。手順書のコマンド列を毎回手で打つ運用は、打ち間違いと手順の省略（特に `pull` の省略）を招く。

スクリプトは自動テストを持たない代わりに、CI の `static` ジョブで shellcheck（`scripts/deploy*.sh`）を通す。動作の担保は実機でのデプロイ成功による。

## 7. 本手順の範囲外

次の作業は通常デプロイでは扱わない。発生時に個別の runbook を書く（事前には書かない）。

- **初回構築**（AWS アカウント〜クローン配置〜`.env.production` 作成〜初回発行〜初回デプロイ）: 別イシュー。ホスト再起動時の起動順序（#762）と合わせて扱う
- **postgres のメジャーバージョン更新**: `pgdata` の dump / restore が要り、`up -d` では済まない
- **ホスト側の前提作業**: `docker` / `git` のインストール、`/etc/letsencrypt` のような bind mount 先の準備、`tls-certificates.md` 2 章のような一回限りの移行
- **`.env.production` の変更**: 手動で編集したあと `scripts/deploy-apply.sh` で再適用する（4.1）。値の管理方法自体は本手順の外

## 8. トラブルシュート

### `pull` で止まった

```
pull 失敗: sha-xxxxxxx が GHCR に無い。Release Image ワークフローが未完了か、main に含まれない commit を指定している
```

- **Release Image が未完了**: GitHub の Actions → Release Image で対象 commit の run が緑になるのを待ってから、`scripts/deploy-apply.sh` で適用フェーズだけをやり直す（HEAD は既に対象 commit へ移っているので git フェーズは不要）
- **main に含まれない commit を指定した**: イメージがあるのは main 上の commit だけ。`git branch -r --contains <commit>` に `origin/main` が出なければ対象外。正しいリリース commit を指定して `scripts/deploy.sh <commit>` からやり直す
- **GHCR に到達できない**: 一時障害なら時間を置く。既に動いているコンテナは影響を受けない（`pull` と `up -d` を分けている理由）

### drift 検出で止まった

```
drift 検出: EC2 上のクローンに未コミットの変更がある
```

続けて `git status --short` の出力が出る。上書きも退避も自動では行わない。

```bash
git status            # 何が変わっているか
git diff              # 追跡ファイルの差分
```

- **意図しない編集**（誤操作・試行の残骸）: `git checkout -- <ファイル>` で捨てる。未追跡ファイルは中身を確認してから `rm` する
- **必要な変更**（EC2 上で調整して動いた nginx 設定など）: 内容を控えて develop へ PR を出し、main にマージしてから通常手順で反映する。EC2 上の変更はその後に捨てる
- `.env.production` は `.gitignore` 済みで drift にならない。ここに出るなら `.gitignore` が壊れている

### `up --wait` がタイムアウトした／migrate が失敗した

```bash
docker compose -f compose.prod.yaml --env-file .env.production ps -a
docker compose -f compose.prod.yaml --env-file .env.production logs migrate
docker compose -f compose.prod.yaml --env-file .env.production logs --tail 100 app
```

- `migrate` が異常終了していれば `app` は起動しない（`service_completed_successfully`）。マイグレーションの失敗は 5.3 の作り直しで復旧する
- `migrate` は正常終了しているのに `app` が healthy にならない場合は `app` のログを見る。`DATABASE_URL` / `BETTER_AUTH_*` の不備（`.env.production`）が典型
- `nginx` / `certbot` は healthcheck を持たないため `--wait` は起動（running）だけを待つ。これらが原因で待ち続けることは無い

### health の `curl` で止まった

`up --wait` は通っている（app は healthy）のに最後の `curl` が失敗する場合、nginx から先が疑わしい。

```bash
docker compose -f compose.prod.yaml --env-file .env.production logs --tail 50 nginx
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/api/health           # 80 → 301 が期待値
curl -sS -o /dev/null -w '%{http_code}\n' --resolve chapple-esm.duckdns.org:443:127.0.0.1 https://chapple-esm.duckdns.org/api/health
```

外部からはサイトが見えているのに EC2 自身からの `curl` だけ失敗する場合は、自分の公開 IP へ戻る経路（ヘアピン）の問題。`--resolve` でローカルの 443 に向けて確認する。

### 本当にイメージから動いているか

「EC2 上のソースが使われているのでは」という疑いは、次で機械的に否定できる。

```bash
# app コンテナが参照しているイメージ（タグが sha-xxxxxxx で、HEAD の先頭 7 文字と一致すること）
docker compose -f compose.prod.yaml --env-file .env.production images app
git rev-parse HEAD | cut -c1-7

# そのイメージが GHCR から来たものであること（RepoDigests に ghcr.io のダイジェストが付く。
# EC2 上でビルドしたイメージには付かない）
eval "$(scripts/deploy-env.sh)"
docker image inspect "$APP_IMAGE" --format '{{index .RepoDigests 0}}'
```

### 偽のローカルタグが残っている

過去に `build:` 併記のまま pull に失敗した環境では、GHCR に存在しないタグ名を持つローカルビルドのイメージが残っていることがある（PR #785 で実測）。compose のイメージ解決は「ローカルタグ → pull → build」の順なので、`pull` を省くとこれが拾われ続ける。

本手順は `pull` を必須にしているため通常は問題にならない（GHCR のものに上書きされるか、GHCR に無ければ止まる）。心配なら `RepoDigests` の確認（上記）で見分けられ、`docker rmi <イメージ>` で消せる。
