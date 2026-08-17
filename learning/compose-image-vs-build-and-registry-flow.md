# compose の image / build の役割分担とレジストリ配布フロー

作成日: 2026-08-11

## 概要

`compose.prod.yaml` の

```yaml
migrate:
  image: ${MIGRATE_IMAGE:-ghcr.io/chapplehub/estimate-management-system/migrate:latest}
  build:
    context: .
    target: migrate
```

について「マイグレーションに使うのは Dockerfile の migrate ステージのはずなのに、なぜ GHCR のアドレスが書いてあるのか」という疑問を起点に、`image:` と `build:` の役割の違い、マルチステージのステージ名がイメージには残らないこと、本番でビルドせず CI ビルド + pull にする理由、`${VAR:-default}` の展開規則を整理した。

Dockerfile 単体の読み解きは [production-dockerfile-multistage.md](./production-dockerfile-multistage.md) を参照。本ファイルはその**外側**（イメージにどう名前を付け、どう本番に届けるか）が主題。

## 詳細

### `image:` は「Dockerfile の場所」を書く欄ではない

混乱の原因は、`image:` を「使うイメージの作り方を指す欄」と読んでしまうこと。実際の役割分担は:

| キー | 意味 | `docker` コマンドでの対応 |
| --- | --- | --- |
| `build:` | **どう作るか**（コンテキストとターゲットステージ） | `docker build --target migrate .` |
| `image:` | **成果物に付ける／取ってくる名前** | `-t ems-migrate:local` |

「Dockerfile の場所を示す」役割はすでに `build.context` が担っている。`image:` は名札であって設計図ではない。

### ステージ名はイメージには残らない

```
Dockerfile の migrate ステージ ──build──▶ 1個のイメージ ──tag──▶ ghcr.io/.../migrate:latest
      （ビルドの入力）                   （中身）                  （出力に付けた名前）
```

マルチステージの**ステージ名はビルド時にしか存在しない**。ビルド後のイメージに「私は migrate ステージ由来」という情報は入っておらず、`runner` 由来のものと区別がつかない。だから 1 つの Dockerfile から出る 2 つの成果物を区別するには、それぞれ別名を付けて別リポジトリに保管するしかない:

- `ghcr.io/chapplehub/estimate-management-system/migrate:latest` ← `--target migrate` の産物
- `ghcr.io/chapplehub/estimate-management-system/app:latest` ← `--target runner` の産物

`migrate` という語が `target:` と `image:` の両方に出るのは重複記述ではなく、**入力側の指定と出力側の名前がたまたま同じ単語**というだけ。

### なぜ本番（EC2）でビルドしないのか

`build:` があるなら本番でもそれで作ればよさそうだが、そうしない理由:

- ビルドにはリポジトリのソース一式・`pnpm install`・`next build` が必要。EC2 に git clone してビルド環境を持ち込むことになる
- `next build` はメモリを食う。小さいインスタンスでは OOM で落ちうるし、落ちるのは「デプロイ中」＝サービス停止中
- 同一 commit でもビルドするマシン・時刻で結果が変わりうる。CI で 1 回だけビルドしたイメージをそのまま動かせば、**検証したものと本番で動くものが物理的に同一**だと保証できる
- ロールバックがタグの差し替えだけで済む（`APP_IMAGE=...:v1.2.2` に戻して `up -d`）

想定フローは **CI でビルド → GHCR に push → EC2 では pull するだけ**。[production-dockerfile-multistage.md](./production-dockerfile-multistage.md) の設計原則「ビルドと実行の分離」（ビルド時に DB 接続なし・秘密なし）は、この配布フローを成立させるための前提条件だった。

### 1 ファイルで本番とローカル検証を兼ねる仕掛け

```yaml
image: ${MIGRATE_IMAGE:-ghcr.io/.../migrate:latest}   # 既定 = GHCR から pull（本番）
build:                                                # 変数で上書きした時だけ使う（ローカル検証）
  context: .
  target: migrate
```

- **本番**: 変数を設定しない → デフォルト値の GHCR タグを pull。`build:` は出番なし
- **ローカル検証**: `.env.production` に `MIGRATE_IMAGE=ems-migrate:local` → 事前に `docker build --target migrate -t ems-migrate:local .` で作ったローカルイメージが使われる

`build:` を残しておくことで `docker compose -f compose.prod.yaml build` 一発でも検証用イメージを作れる。**compose ファイルを環境ごとに分岐させずに済む**のが狙い。

### `${VAR:-default}` の展開規則

Compose の変数展開（interpolation）は POSIX シェルのパラメータ展開を模したもので、YAML でも Docker Engine でもなく **Compose CLI が読み込み時に文字列置換**する。

```
${MIGRATE_IMAGE:-ghcr.io/chapplehub/estimate-management-system/migrate:latest}
  └─ 変数名 ──┘└┬┘└──────────── デフォルト値 ────────────────────┘
                └─「未設定または空なら」
```

`${` 直後から**最初の演算子まで**が変数名、そこから閉じ `}` までが丸ごとデフォルト値。デフォルト値内の `:latest` の `:` はただの文字。

| 構文 | 挙動 |
| --- | --- |
| `${VAR:-default}` | 未設定**または空文字**なら default |
| `${VAR-default}` | 未設定のときだけ default（空文字はそのまま空） |
| `${VAR:?message}` | 未設定または空ならエラーで停止（必須変数の宣言） |
| `${VAR:+value}` | 設定済みなら value |
| `$${VAR}` | `$` のエスケープ。Compose は展開せずコンテナ側に `${VAR}` を渡す |

`-` ではなく `:-` を選ぶ意味: `.env.production` に `MIGRATE_IMAGE=`（キーだけ残して値を消す）と書かれても GHCR にフォールバックする。env ファイルで値だけ消すのはよくある操作なので `:-` の方が事故に強い。

**落とし穴**: 未定義変数はエラーにならず空文字になる。`image: ${APP_IMAGE}` とだけ書くと `image: ""` という分かりにくい失敗をする。常に `:-`（デフォルト）か `:?`（必須宣言）を付けるのが安全側。

### 展開のタイミングの違い（同ファイル内の対比）

```yaml
environment:
  POSTGRES_USER: ${POSTGRES_USER}                              # ホスト側で確定
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} ..."]   # コンテナ内シェルが展開
```

同じ変数名でも、`$` 1 つは `--env-file` の値がホスト側で埋め込まれ、`$$` はエスケープされてコンテナ内で解決される。healthcheck は後者でないと意図がずれる。

## 未解決 / 次にやること

- `.github/workflows/` は現状 `ci.yml` と `playwright.yml` のみで、**GHCR に push するワークフローは未作成**。デフォルト値の GHCR タグは「将来 CI がここに置く」という予約であり、今 EC2 で変数なしに起動すると pull に失敗する。デプロイまで通すなら build & push ワークフローが次の必要ピース
- 本番タグが `latest` 固定だと「今どの commit が動いているか」が追えずロールバックもできない。実運用では commit SHA / バージョンタグを `.env.production` の `APP_IMAGE` に書く運用とし、`:-` のデフォルトは保険という位置づけにする

## 参考

- 関連ファイル: `compose.prod.yaml`, `Dockerfile`, `.env.production.example`, `CLAUDE.md`（Production Docker セクション）
- 関連メモ: [production-dockerfile-multistage.md](./production-dockerfile-multistage.md)
- Issue #758（プロダクション Docker 構成）
- Compose 変数展開（interpolation）: https://docs.docker.com/reference/compose-file/interpolation/
- Compose の `build` と `image` の併用: https://docs.docker.com/reference/compose-file/build/
