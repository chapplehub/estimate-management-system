# CLAUDE.md

## Major premise

常に日本語で対話すること

## Git Branch Strategy

- defalut branch: `develop`
- branch naming rule: `feat/issue-{number}`, `fix/issue-{number}`, `docs/issue-{number}`

## Git Hooks (husky)

コミット・プッシュ時に husky が自動でチェックを走らせる。エージェントはこのコストを前提にコミット単位を設計すること。

- **pre-commit**: `lint-staged`（eslint --fix + prettier --write）→ staged コードの**関連テストのみ** `vitest related` を実行。`src/`・`prisma/`・ルートの `.ts/js/mjs/tsx/jsx` が staged された時だけ走り、docs のみのコミットはスキップされる。
  - → **各コミットは関連テストが緑になる単位で区切る**こと。テストが割れる中間状態でコミットしない。
- **commit-msg**: `commitlint` で type を検証（許可 type は `.claude/references/commit-types.md`）。
- **pre-push**: `tsc --noEmit`（全体型チェック）+ `vitest run`（フルスイート）。個別コミットでは型全体・全テストは担保されない点に注意。
- フックを無効化（`--no-verify`）してコミット／プッシュしないこと。

## Commit Rule

- **Commit at each meaningful change**: コードの編集・追加をしたら、意味のあるまとまりの時点でコミットする。一括実装してまとめてコミットしない。
- **Record design decisions in commit body**: コミット対象に設計判断（実装方式の選択、レイヤー配置、データ構造の決定など）が含まれる場合、その判断理由をコミットボディに記載する。
  - 例: 「バリデーションをドメイン層ではなくアプリケーション層に配置。理由: 外部API依存のチェックを含むため」
  - 例: 「Mapではなく配列で管理。理由: 要素数が常に少なく、順序保証が必要なため」
- **Record deviations from plan**: 実装中に計画と異なる対応をした場合、作業完了時に `docs/claude-plans/issue-{number}/deviations.md` に{元の計画内容}、{実際の実装内容}、{逸脱の理由}を記録すること。
- Commit types: `.claude/references/commit-types.md` を参照

## Critical: DDD Layering Rules

**NEVER violate these rules:**

1. Domain layer MUST NOT depend on infrastructure, application, or presentation layers
2. Domain layer MUST NOT import Prisma, Next.js, or any external libraries
3. Application layer uses repository **interfaces** from domain layer, NOT concrete implementations
4. Infrastructure layer implements domain interfaces and handles Prisma <-> Domain mapping

## Dev DB (Docker)

開発・テスト用の PostgreSQL は Docker Compose で起動する（Issue #755）。Next.js アプリはホストで `pnpm dev` を実行する（コンテナ化しない）。

```bash
docker compose up -d --wait   # DB起動（dev / unit / e2e の3DBは初回起動時に自動作成）
docker compose down           # DB停止（データは pgdata ボリュームに残る）
docker compose down -v        # DB完全リセット（ボリューム削除。次回起動時にinitdb再実行）
```

- 接続先は従来どおり `localhost:5432`（`.env*` の `DATABASE_URL` は変更不要）
- unit / e2e 用DBの作成は `docker/db/initdb/01-create-databases.sql`（データボリュームが空の初回のみ実行）
- DB完全リセット後は `pnpm db:migrate && pnpm db:seed` / `pnpm test:setup` / `pnpm e2e:setup` で再構築する

## Production Docker (ローカル検証)

プロダクション用構成は `Dockerfile`（standalone + migrate ステージ）+ `compose.prod.yaml` + `docker/nginx/`（Issue #758）。EC2 デプロイ前提だが、ローカルで一式検証できる。

デプロイ先は**本番ではなく公開デモ環境**と定義している（ADR-20260821-4f1）。実業務データを扱わず、ダミーデータ込みで動きを見せる場所であるため、初期データ投入には開発 seed（`prisma/seed-dev.ts`）をそのまま流用する。

```bash
# 1. env 準備（値を埋める。git 管理外・キー名は example 参照）
cp .env.production.example .env.production
# ローカル検証時は APP_IMAGE / MIGRATE_IMAGE にローカルビルドのタグを指定する

# 2. イメージビルド
docker build --target runner -t ems-app:local .
docker build --target migrate -t ems-migrate:local .

# 3. 一式起動（db → migrate（one-shot）→ app → nginx の順に自動起動）
docker compose -f compose.prod.yaml --env-file .env.production up -d --wait

# 4. 動作確認（Nginx 経由。公開ポートは 80/443 のみ）
#    http://localhost/api/health が 200、http://localhost/signin がログイン画面

# 5. 片付け
docker compose -f compose.prod.yaml --env-file .env.production down -v
```

- dev 用 compose とはプロジェクト名・ボリュームが分離されており同時起動可（ポート衝突なし）
- `--env-file` を明示すること（省略すると `.env`（dev 用）が読まれる）
- HTTPS/certbot はドメイン取得後に有効化（手順は `docker/nginx/conf.d/app-ssl.conf.example`）

### 初期データ投入（公開デモ環境 / Issue #765）

`up -d` では seed は走らない（`profiles: ["seed"]` で除外）。**初回デプロイ後に下記を叩き忘れると、DB が空のままのアプリが公開される。**

以下の3コマンドを順に実行する（`up -d --wait` が成功した状態から始める）。

```bash
# 1. アプリだけ停止する（db は止めない。seed の接続先なので）
docker compose -f compose.prod.yaml --env-file .env.production stop app

# 2. seed を1回だけ実行する（--profile seed が無いと「サービスが無い」と言われる）
docker compose -f compose.prod.yaml --env-file .env.production --profile seed run --rm seed

# 3. アプリを再開する
docker compose -f compose.prod.yaml --env-file .env.production start app
```

各コマンドの意味:

1. **`stop app`** — seed の `deleteMany` は1トランザクションに包まれておらず、実行中は「一部テーブルだけ空」の中間状態が外から読める。それを見せないためにアプリを止める。止めている間 `http://localhost` は Nginx が **502** を返すが正常
2. **`--profile seed run --rm seed`** — 初期データ投入の本体。`--profile seed` は必須（`up -d` で誤爆しないよう seed サービスを profile で隔離しているため）。`run --rm` は1回実行してコンテナを捨てる指定
3. **`start app`** — 再開。数秒で healthy に戻る

補足:

- **破壊的**: seed は全テーブルを `deleteMany` してから作り直す。既存データは残らない。何度叩いても同じ結果になる代わりに、投入済みの内容は毎回失われる
- 完了時に**ログインアカウント一覧**が出力される（`employee1@example.com` 〜、共通パスワードも表示される）。先頭26件が役職・役割の決まった固定アカウントで、残りはランダム生成
- 所要時間はローカル実測で 300人 2.2秒 / 2000人 12秒
- seed は `migrate` イメージに相乗りしている（`command` を `tsx prisma/seed-dev.ts` に上書き）。専用イメージ・専用 `*_IMAGE` 変数は無いので、**`MIGRATE_IMAGE` を指定していればそれがそのまま seed に使われる**
- `.env.production` の任意キー（未設定なら seed 内の既定値を使う）:
  - `SEED_DEFAULT_PASSWORD` — デモアカウント共通のパスワード。未設定だとリポジトリに書かれた既定値がそのまま実環境の値になる
  - `SEED_TOTAL_EMPLOYEES` — 生成するダミー従業員数（既定 2000）。**26未満は不可**（固定ログインアカウントが26件あり、下回ると固定課員が作られず見積 seed が前提不足で落ちる）。範囲外の値は `deleteMany` に到達する前に例外で止まるので DB は壊れない
  - 空値（`KEY=`）は未設定として扱われる

## Unit Tests

単体テスト（vitest）は開発DBと分離した専用DB（`.env.unit` の `DATABASE_URL`）を使う（Issue #584）。

```bash
pnpm test:setup   # 単体テスト用DB初期化（DB作成 → migrate deploy → 正準マスタseed投入）。初回・schema変更時に実行
pnpm test         # 正準マスタ再シード + 単体テスト実行
```

- 初回は `cp .env.unit.example .env.unit` で env を用意してから `pnpm test:setup` を実行する
- seed（`prisma/seed-unit.ts`）は正準マスタ（役職・役割・消費税率）のみ。シナリオデータは各テストが自前生成する

## E2E Tests

```bash
pnpm e2e          # テストデータ再シード + E2Eテスト実行
pnpm e2e:setup    # テストDB初期化
pnpm e2e:seed     # テストデータ再シード
```

- CRUDテストは `test.describe.serial` で直列化（create→update→delete）
- テスト内でPrismaクライアントを直接使わない（技術制約: ADR-0012参照）
