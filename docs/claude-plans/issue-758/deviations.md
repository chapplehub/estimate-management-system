# Issue #758: 計画からの逸脱記録

## 1. build ステージにダミー DATABASE_URL を追加（Step 2）

- **元の計画内容**: Dockerfile の build ステージは「prisma generate + next build」を実行し、ビルド時に DB 接続しない・秘密情報を焼き込まない、とだけ規定
- **実際の実装内容**: `RUN` 内でのみ有効なダミー値 `DATABASE_URL=postgresql://build:build@build-placeholder:5432/build` を渡して `prisma generate` / `next build` を実行（イメージの `ENV` には残さない）
- **逸脱の理由**: Prisma 7 の `prisma.config.ts` は config ロード時に `env("DATABASE_URL")` を即時解決するため、未設定だと `prisma generate` が `PrismaConfigEnvError` で失敗する（初回ビルドで実測）。generate / build は DB へ接続しないため値はプレースホルダで良く、「DB 非接続・秘密情報なし」という計画の意図は維持している

## 2. .gitignore への例外追加（Step 3）

- **元の計画内容**: Step 3 の対象ファイルは `compose.prod.yaml` と `.env.production.example` のみ
- **実際の実装内容**: `.gitignore` に `!.env.production.example` を 1 行追加
- **逸脱の理由**: 既存の `.gitignore` は `.env*` を一括 ignore しており、例外を追加しないと `.env.production.example` を git 管理に載せられない（既存の `!.env.example` 等と同型の機械的な追加）
