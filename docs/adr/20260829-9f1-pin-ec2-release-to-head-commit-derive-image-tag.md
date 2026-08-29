# ADR-20260829-9f1: EC2 の稼働リリースをクローンの HEAD commit に固定し、イメージタグをそこから導出する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-08-29 |
| 最終更新日 | 2026-08-29 |

## コンテキスト

公開デモ環境（ADR-20260821-4f1）は #758 のスタック（`compose.prod.yaml`: db / migrate / seed / app / nginx / certbot）で稼働している。アプリのイメージは `release-image.yml` が main への push ごとにビルドして GHCR へ `latest` と `sha-<先頭 7 文字>` の 2 タグで push し（「`latest` = main の写像」が不変条件）、EC2 は pull するだけでビルドしない（#761 / ADR-20260818-7pn）。EC2 には リポジトリのクローンが置かれ、`compose.prod.yaml` と `docker/nginx/conf.d/` はそこから読まれる。`.env.production` は git 管理外で手動配置する。

つまり EC2 に届くものは 2 経路ある。**アプリの中身**は GHCR のイメージ、**起動の宣言**（compose ファイルと nginx 設定）は git のクローン。どちらも起点は main のマージだが、両者を結び付けるものが無かった。

- `compose.prod.yaml` の `APP_IMAGE` / `MIGRATE_IMAGE` は既定値 `latest` で、可変タグである。**「今どの commit のイメージが動いているか」を決める情報が git のどこにも無く**、EC2 に聞かないと分からない
- イメージ（`latest`）と宣言（クローンの checkout 位置）の世代が対応する保証が無い
- ロールバックの手段が `.env.production` にタグを手書きすることしかなく、それ自体が drift になる
- `docker compose up -d` は既にローカルにあるタグを再 pull しない（PR #785 で実測）。`pull` を省くと「デプロイしたつもり」で旧版が動き続ける。過去に `build:` フォールバックが走った環境には、GHCR に存在しないタグ名の偽のローカルイメージが残っていることもある

通常デプロイ手順書（`docs/ops/deploy.md`、#784）を書くには、この結び付け方を先に決める必要がある。決め方は EC2 クローンの git 操作モデル・デプロイスクリプトの形・ロールバック手順・seed / TLS の既存手順書に染み込むため、ADR として固定する。

## 検討した選択肢

### A. `latest` を追従する（不採用・現状）

EC2 のクローンは main ブランチを `git pull` で追い、イメージは既定値の `latest` を使う。ロールバックは `.env.production` に `*_IMAGE=…:sha-xxxxxxx` を書いて `up -d` する。

- 利点: 追加の仕組みが要らない。
- 欠点: 動いているものが git から決まらない（上記コンテキストの問題がそのまま残る）。宣言とイメージの世代が独立に動く。ロールバックが drift を生む。

### B. クローンの HEAD commit に固定し、イメージタグを HEAD から導出する（採用）

EC2 のクローンを「指定されたリリース commit に **detach された読み取り専用チェックアウト**」と定義する。デプロイは `git fetch` → `git checkout --detach <ref>`（既定 `origin/main`）で HEAD を動かし、イメージタグは `sha-$(git rev-parse HEAD | cut -c1-7)` として**機械的に導出**して `APP_IMAGE` / `MIGRATE_IMAGE` にシェル環境変数で渡す（compose の優先順位はシェル環境変数 > `--env-file` > 既定値なので `.env.production` は秘密専用のまま）。`docker compose pull` は無条件・必須にし、GHCR にタグが無ければそこで止める。

- 利点: **「EC2 で動いているものは HEAD commit で一意に決まる」** が成り立つ。`release-image.yml` の `type=sha` と EC2 側が同じ commit を同じ 7 文字に縮めるため、両経路が同じキーで結び付く。ロールバックは `<旧 commit>` を指定して同じ手順を打つだけで、`.env.production` を触らない。通常デプロイとロールバックが同じ 1 コマンドになる。
- 欠点: detached HEAD が常態になる（git の慣習から外れて見える）。イメージがあるのは main に含まれる commit だけなので、それ以外を指定すると pull で失敗する（意図どおりだが、初見では戸惑う）。`latest` の既定値は compose に残るため、スクリプトを経由しない手動 `up -d` や `run --rm seed` は `latest` に解決して HEAD と世代がずれうる。

ブランチを追う（`git pull --ff-only`）形で同じことをする案も検討したが、ロールバック後に同じ手順を再実行すると fast-forward で旧 commit が打ち消され、また変更が入ってこないファイルの直接編集や未追跡ファイルの追加を検出できないため、detach に決めた。drift の検出は `git status --porcelain` の非空判定で行う。

### C. Watchtower 等の pull 型自動更新（不採用）

EC2 上の常駐エージェントが GHCR の `latest` を監視し、更新があればコンテナを差し替える。

- 利点: main マージだけでデプロイが完了する。
- 欠点: migrate one-shot と相性が悪い。app だけが差し替わって未適用マイグレーションのまま起動する経路ができ、`service_completed_successfully` の保証が壊れる。起動の宣言（compose / nginx 設定）は git 経路のままなので、2 経路の結び付きも解決しない。

### D. ECS / App Runner / k8s へ移行する（不採用）

オーケストレータにイメージのロールアウトとロールバックを任せる。

- 利点: 「動いているリビジョン」の管理が基盤機能として得られる。
- 欠点: デモ環境 1 台には過剰で、compose + nginx + certbot に投じた学習を捨てることになる。DB がコンテナ内にある限り、可用性の面でもメリットが出ない。RDS 移行を決めたときに再検討する。

## 決定

EC2 のクローンをリリース commit に detach された読み取り専用チェックアウトと定義し、イメージタグを HEAD commit から `sha-<先頭 7 文字>` として導出する（選択肢 B）。`docker compose pull` は無条件・必須とし、ロールバックは旧 commit を指定した同じ手順で行う。

## 根拠

- **2 経路を 1 つのキーで結び付けられるのは B だけ。** A と C は「どの commit のイメージが動いているか」を git に持たせない。D は基盤を替えることで解決するが、解決したい問題の大きさに対して代償が釣り合わない。
- **成果物の不変性を使い切る。** `release-image.yml` が `sha-<short>` タグを無期限に残しているのは、過去に実際に動いていたバイト列そのものへ戻すためであり、B はその設計意図をそのまま手順にする。「ビルドを再現する」（EC2 上ビルド）と「成果物を取っておく」は別物で、#758 / #761 で前者を退けた以上、後者を使うのが筋。
- **失敗が止まる方向に倒れる。** `pull` はタグが無ければ失敗し、`build:` が無いのでフォールバックしない（#761）。`pull_policy: always` で同じ効果を狙う案は「取りに行く」と「起動する」を癒着させ、GHCR 障害時にローカルにあるイメージでの再起動まで奪うため採らない（理由は `compose.prod.yaml` 冒頭のコメント）。
- **detached HEAD の違和感より、ブランチ追従の穴のほうが重い。** 違和感は手順書に「これが正常状態」と書けば吸収できるが、ロールバックが打ち消される穴は手順の分岐（通常とロールバックで別手順）でしか塞げず、その分岐が次の事故の入口になる。

## 影響

- **detached HEAD が EC2 クローンの正常状態になる。** `git status` に `HEAD detached at …` と出るのは想定どおりで、ブランチへ戻す操作は不要かつ禁止（`docs/ops/deploy.md`）。
- **`latest` タグは残るが、EC2 の正規経路では使わない。** `release-image.yml` は `latest` を push し続け、compose の既定値も残す（読み取り系コマンドを変数必須にしないため）。その代わり、`up -d` と seed は HEAD からタグを導出する経路（デプロイスクリプト／`scripts/deploy-env.sh`）だけを正規とし、`docs/ops/tls-certificates.md` と `docs/ops/demo-seed.md` をそれに揃える。
- **イメージがあるのは main に含まれる commit だけ。** それ以外の commit を指定したデプロイは `pull` で止まる。Release Image ワークフローの完了を待たずにデプロイしても同様に止まる（後続の自動化イシューで順序を機械化するまでは、Actions の完了を目視で確認する）。
- **ロールバックで戻るのはイメージと起動宣言だけで、DB スキーマは戻らない。** マイグレーションを跨ぐロールバックと migrate 失敗時の復旧は、デモ環境である以上（ADR-20260821-4f1）`down -v` → デプロイ → seed の「作り直し」に一本化し、`migrate resolve` は手順に書かない。実業務データを持つ環境になった時点で別 runbook が要る。
- **クローンに追跡ファイルの編集・未追跡ファイルの追加があればデプロイは止まる。** EC2 上で設定を直接編集する運用は成立しない。変更は必ず develop → main を経由する。
- **配置ファイルを sparse-checkout で絞ることはしない。** git 外の状態（`.git/info/sparse-checkout`）を作ると「動いているものが git から決まる」の例外になる。理由の詳細は `docs/ops/deploy.md`。
- `CONTEXT.md` には何も追加しない。リリース・デプロイ・drift はデプロイ環境の語彙であり、見積業務の用語集に属さない。
