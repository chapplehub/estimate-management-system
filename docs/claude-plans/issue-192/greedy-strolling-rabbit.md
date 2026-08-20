# Issue #192: 全テーブルのDateTimeカラムをtimestamptz（タイムゾーン付き）に移行 — 実装計画

## 概要

Prismaスキーマの全12モデル・29個のDateTimeフィールドに `@db.Timestamptz(3)` を追加し、PostgreSQL上のカラム型を `timestamp(3)` から `timestamptz(3)` に移行する。マイグレーションSQL内で `SET TimeZone = 'UTC'` を実行し、既存データのタイムゾーンシフトを防止する。

ドメイン層・アプリケーション層の変更は不要（PrismaはDateTime型に対して `timestamp` / `timestamptz` どちらでもJavaScript `Date` オブジェクトを透過的に扱うため）。

## 設計判断

### マイグレーションSQLの生成方式
- A. `prisma migrate dev --create-only` で自動生成し、`SET TimeZone = 'UTC'` を手動で先頭に追加
- B. 空のマイグレーションディレクトリを作り、SQLを完全に手書き
- 推奨: A（Prismaがスキーマ差分から全29カラムのALTER文を正確に生成するため、漏れ・誤りリスクが低い）

## 対象カラム一覧（29カラム / 12テーブル）

### ドメインテーブル（16カラム / 8テーブル）

| テーブル | DBカラム名 | Nullable | DEFAULT |
|---------|-----------|----------|---------|
| `positions` | `created_at`, `updated_at` | NOT NULL | `created_at` のみ |
| `roles` | `created_at`, `updated_at` | NOT NULL | `created_at` のみ |
| `employee_roles` | `created_at`, `updated_at` | NOT NULL | 両方あり |
| `employees` | `created_at`, `updated_at` | NOT NULL | `created_at` のみ |
| `departments` | `created_at`, `updated_at` | NOT NULL | `created_at` のみ |
| `companies` | `created_at`, `updated_at` | NOT NULL | `created_at` のみ |
| `customers` | `created_at`, `updated_at` | NOT NULL | `created_at` のみ |
| `delivery_locations` | `created_at`, `updated_at` | NOT NULL | `created_at` のみ |

### better-authテーブル（13カラム / 4テーブル）

| テーブル | DBカラム名 | Nullable | DEFAULT |
|---------|-----------|----------|---------|
| `user` | `createdAt`, `updatedAt` | NOT NULL | `createdAt` のみ |
| `user` | `banExpires` | NULLABLE | なし |
| `session` | `expiresAt`, `createdAt`, `updatedAt` | NOT NULL | `createdAt` のみ |
| `account` | `createdAt`, `updatedAt` | NOT NULL | `createdAt` のみ |
| `account` | `accessTokenExpiresAt`, `refreshTokenExpiresAt` | NULLABLE | なし |
| `verification` | `expiresAt`, `createdAt`, `updatedAt` | NOT NULL | `createdAt` のみ |

## ステップ

### Step 0: ADR起票

- 対象ファイル: `docs/adr/0010-migrate-datetime-to-timestamptz.md`（新規）, `docs/adr/INDEX.md`
- 作業内容:
  - ADR-0010を作成（timestamptzへの移行判断を記録）
  - INDEX.mdのインフラストラクチャカテゴリにエントリ追加
- コミットメッセージ: `docs: ADR-0010 全DateTimeカラムをtimestamptzに移行する設計判断を記録`

### Step 1: Prismaスキーマの全DateTimeフィールドにTimestamptz(3)を追加

- 対象ファイル: `prisma/schema.prisma`
- 作業内容:
  - 全12モデルの29個のDateTimeフィールドに `@db.Timestamptz(3)` を追加
  - 既存アノテーション（`@default(now())`, `@updatedAt`, `@map(...)` 等）の末尾に追記
  - 変更例:
    - Before: `createdAt DateTime @default(now()) @map("created_at")`
    - After: `createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)`
- コミットメッセージ: `refactor: Prismaスキーマの全DateTimeフィールドに@db.Timestamptz(3)を追加`

### Step 2: マイグレーション生成・UTC保護追加・適用

- 対象ファイル: `prisma/migrations/<timestamp>_migrate_datetime_to_timestamptz/migration.sql`（新規生成）
- 作業内容:
  - `pnpm db:migrate -- --create-only --name migrate_datetime_to_timestamptz` でマイグレーションSQL自動生成
  - 生成されたSQLに29個の `ALTER COLUMN ... SET DATA TYPE TIMESTAMPTZ(3)` が含まれることを確認
  - SQLの先頭に以下を追加:
    ```sql
    -- Protect existing UTC data during timestamp -> timestamptz conversion
    SET TimeZone = 'UTC';
    ```
  - `pnpm db:migrate` でマイグレーション適用
- コミットメッセージ: `refactor: DateTime列をtimestamp(3)からtimestamptz(3)に移行するマイグレーション追加`

### Step 3: 検証

- 対象ファイル: なし（検証のみ）
- 作業内容:
  - `pnpm db:generate` — Prisma Client再生成の確認
  - `pnpm lint` — lint通過
  - `pnpm test` — 全テスト通過
  - `pnpm build` — ビルド成功

## 変更不要の確認

以下は変更不要であることを調査済み:

- **ドメインエンティティ**: JavaScript `Date` を使用。`timestamp` / `timestamptz` どちらでもPrismaが透過的に変換
- **インフラ層マッパー**: タイムスタンプをそのまま受け渡し。型変換なし
- **better-auth**: Prismaアダプター経由でDate読み書き。カラム型の違いは透過的
- **DEFAULT式**: `CURRENT_TIMESTAMP` は `timestamptz` カラムでも正常に動作
- **Prisma Client型**: `DateTime` → TypeScript `Date` のマッピングは `@db.Timestamptz(3)` でも変わらない
