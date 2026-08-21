# estimate-management-system

見積管理システム。

- システム全体の設計: [`docs/system-design-doc.md`](docs/system-design-doc.md)
- アーキテクチャ（DDD）: [`docs/ddd-architecture-overview.md`](docs/ddd-architecture-overview.md)
- 開発ガイドライン（コーディング規約・命名規則など）: [`docs/dev-guidelines.md`](docs/dev-guidelines.md)

## 必要環境

| ツール | バージョン | 備考 |
| --- | --- | --- |
| Node.js | `.nvmrc` の値（現在 24.18.1） | `nvm use` で切り替える |
| pnpm | `package.json` の `packageManager`（現在 11.18.0） | npm / yarn は `preinstall` の `only-allow` で拒否される |
| Docker / Docker Compose | - | PostgreSQL の起動に使う |

## セットアップ

### 1. 依存インストール

```bash
nvm use
pnpm install
```

### 2. 環境変数の用意

`.env*` は git 管理外。example をコピーして値を埋める。

```bash
cp .env.example .env             # 開発用
cp .env.unit.example .env.unit   # 単体テスト用
cp .env.e2e.example .env.e2e     # E2Eテスト用
```

`AUTH_SECRET` は `openssl rand -base64 32` で生成する。

### 3. DB 起動

```bash
docker compose up -d --wait
```

初回起動時に dev / unit / e2e の 3 つの DB が自動作成される（[開発 DB](#開発-dbdocker) 参照）。

### 4. スキーマ適用と初期データ投入

```bash
pnpm db:migrate   # マイグレーション適用
pnpm db:seed      # 開発用ダミーデータ投入
```

`pnpm db:seed` は完了時にログインアカウント一覧（メールアドレスと共通パスワード）を出力する。

### 5. 開発サーバー起動

```bash
pnpm dev
```

<http://localhost:3000> で起動する。Next.js アプリはホストで動かし、コンテナ化しない（理由は `compose.yaml` 冒頭のコメント参照）。

## 開発 DB（Docker）

開発・テスト用の PostgreSQL は Docker Compose で起動する（Issue #755）。

```bash
docker compose up -d --wait   # 起動（dev / unit / e2e の3DBは初回起動時に自動作成）
docker compose down           # 停止（データは pgdata ボリュームに残る）
docker compose down -v        # 完全リセット（ボリューム削除。次回起動時に initdb 再実行）
```

- 接続先は `localhost:5432`（`.env*` の `DATABASE_URL` は変更不要）
- unit / e2e 用 DB の作成は `docker/db/initdb/01-create-databases.sql`。**データボリュームが空の初回起動時のみ**実行される
- ポートは `127.0.0.1` バインドのため LAN には公開されない
- `down -v` で完全リセットした後は、次の 3 つで再構築する

  ```bash
  pnpm db:migrate && pnpm db:seed   # 開発DB
  pnpm test:setup                   # 単体テストDB
  pnpm e2e:setup                    # E2EテストDB
  ```

## 主なコマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | 本番ビルド |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | 型チェック（`next typegen` + `tsc --noEmit`） |
| `pnpm format` | Prettier |
| `pnpm test` | 単体テスト（[docs/testing.md](docs/testing.md)） |
| `pnpm e2e` | E2E テスト（[docs/testing.md](docs/testing.md)） |
| `pnpm db:studio` | Prisma Studio |

## テスト

単体テスト・E2E テストのセットアップと実行は [`docs/testing.md`](docs/testing.md) を参照。

## デプロイ（公開デモ環境）

デプロイ先は本番ではなく**公開デモ環境**と定義している（[ADR-20260821-4f1](docs/adr/20260821-4f1-deploy-target-is-public-demo-reuse-dev-seed.md)）。

- プロダクション構成のローカル検証: [`docs/ops/prod-docker-local.md`](docs/ops/prod-docker-local.md)
- 初期データ投入（**破壊的操作**）: [`docs/ops/demo-seed.md`](docs/ops/demo-seed.md)

## 開発フロー

- ブランチ戦略・コミット規約・DDD レイヤリング規則: [`CLAUDE.md`](CLAUDE.md)
- git worktree の運用: [`docs/git-worktree-rule.md`](docs/git-worktree-rule.md)
- 設計判断の記録（ADR）: [`docs/adr/INDEX.md`](docs/adr/INDEX.md)
