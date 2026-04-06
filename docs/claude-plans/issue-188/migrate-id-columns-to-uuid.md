# Issue #188: 全テーブルのIDカラムをPostgreSQLネイティブUUID型（@db.Uuid）に移行 — 実装計画

## 概要

全テーブル（12テーブル）のIDカラムおよびFK参照カラム（計26カラム）に `@db.Uuid` アノテーションを追加し、PostgreSQL上のカラム型をTEXT→UUIDに変換する。Issue #193（timestamptz移行）と同パターンのカスタムマイグレーションで実施する。

## 設計判断

### マイグレーション方式
- A. `prisma migrate dev` の自動生成SQL → カラム再作成（データロス）のリスクあり
- B. `--create-only` でスキャフォールド後、カスタムSQLに差し替え
- 推奨: B（Issue #193の timestamptz 移行と同じ実績あるパターン）

### FK制約の扱い
- A. ALTER TYPE のみ（FK制約は維持したまま）→ PostgreSQLは単一トランザクション内なら許容する場合がある
- B. FK制約を一旦DROP → ALTER TYPE → FK制約を再ADD
- 推奨: A を先に試し、失敗した場合は B にフォールバック

### Session.impersonatedBy の扱い
- better-auth Admin PluginがユーザーIDを格納するカラム → `@db.Uuid` を追加する
- `Account.accountId` はプロバイダ固有のIDであり UUID ではない → スキップ

### better-auth の `generateId` 設定について
- better-authドキュメントに `generateId: "uuid"` オプションの記載があるが、**変更不要**
- `"uuid"` を設定するとPostgreSQLの `gen_random_uuid()`（UUIDv4）が使われ、UUIDv7の設計意図（時系列ソート可能）に反する
- 現在の `generateId: () => generateId()` でUUIDv7文字列を生成しており、Prismaが `@db.Uuid` カラムへの変換を自動処理するため問題なし
- ソースコード確認済み: Prismaアダプタは `supportsUUIDs: true`（PostgreSQL）を設定するが、カスタム関数指定時はこのフラグに関係なく関数が呼ばれる

## 対象カラム一覧（26カラム）

| テーブル | カラム（DB名） | 種別 | Nullable |
|---|---|---|---|
| `positions` | `id` | PK | No |
| `positions` | `superior_position_id` | 自己参照FK | Yes |
| `roles` | `id` | PK | No |
| `roles` | `superior_role_id` | 自己参照FK | Yes |
| `roles` | `position_id` | FK → positions | No |
| `employee_roles` | `employee_id` | 複合PK + FK | No |
| `employee_roles` | `role_id` | 複合PK + FK | No |
| `employees` | `id` | PK | No |
| `employees` | `department_id` | FK → departments | No |
| `employees` | `superior_role_id` | FK → roles | Yes |
| `departments` | `id` | PK | No |
| `departments` | `parent_id` | 自己参照FK | Yes |
| `companies` | `id` | PK | No |
| `customers` | `id` | PK | No |
| `customers` | `company_id` | FK → companies | No |
| `delivery_locations` | `id` | PK | No |
| `delivery_locations` | `company_id` | FK → companies | No |
| `delivery_locations` | `customer_id` | FK → customers | No |
| `user` | `id` | PK | No |
| `user` | `employee_id` | FK → employees | Yes |
| `session` | `id` | PK | No |
| `session` | `userId` | FK → user | No |
| `session` | `impersonatedBy` | ユーザーID格納 | Yes |
| `account` | `id` | PK | No |
| `account` | `userId` | FK → user | No |
| `verification` | `id` | PK | No |

## ステップ

### Step 1: Prismaスキーマに `@db.Uuid` アノテーション追加

- 対象ファイル: `prisma/schema.prisma`
- 作業内容:
  - 上記26カラムすべてに `@db.Uuid` を追加
  - パターン: `String @id` → `String @id @db.Uuid`、`String @map(...)` → `String @map(...) @db.Uuid`
  - `Account.accountId` は対象外（プロバイダ固有IDのため）
- コミットメッセージ: `refactor: Prismaスキーマの全ID/FKカラムに@db.Uuidアノテーション追加`

### Step 2: カスタムマイグレーションSQL作成・適用

- 対象ファイル: `prisma/migrations/YYYYMMDD_migrate_id_to_uuid/migration.sql`（新規）
- 作業内容:
  - `pnpm prisma migrate dev --create-only --name migrate_id_to_uuid` でスキャフォールド
  - 生成されたSQLをカスタムSQLに差し替え（`ALTER COLUMN ... SET DATA TYPE UUID USING col::uuid`）
  - `pnpm prisma migrate dev` で適用
  - `pnpm db:generate` でPrismaクライアント再生成
- マイグレーションSQL:
  ```sql
  -- 全ID/FKカラムをTEXT→PostgreSQLネイティブUUID型に変換
  -- 既存データはUUIDv7形式文字列のため ::uuid キャストで変換可能

  -- positions
  ALTER TABLE "positions" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "superior_position_id" SET DATA TYPE UUID USING "superior_position_id"::uuid;

  -- roles
  ALTER TABLE "roles" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "superior_role_id" SET DATA TYPE UUID USING "superior_role_id"::uuid,
  ALTER COLUMN "position_id" SET DATA TYPE UUID USING "position_id"::uuid;

  -- employee_roles
  ALTER TABLE "employee_roles" ALTER COLUMN "employee_id" SET DATA TYPE UUID USING "employee_id"::uuid,
  ALTER COLUMN "role_id" SET DATA TYPE UUID USING "role_id"::uuid;

  -- departments
  ALTER TABLE "departments" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "parent_id" SET DATA TYPE UUID USING "parent_id"::uuid;

  -- employees
  ALTER TABLE "employees" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "department_id" SET DATA TYPE UUID USING "department_id"::uuid,
  ALTER COLUMN "superior_role_id" SET DATA TYPE UUID USING "superior_role_id"::uuid;

  -- companies
  ALTER TABLE "companies" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid;

  -- customers
  ALTER TABLE "customers" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "company_id" SET DATA TYPE UUID USING "company_id"::uuid;

  -- delivery_locations
  ALTER TABLE "delivery_locations" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "company_id" SET DATA TYPE UUID USING "company_id"::uuid,
  ALTER COLUMN "customer_id" SET DATA TYPE UUID USING "customer_id"::uuid;

  -- user
  ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "employee_id" SET DATA TYPE UUID USING "employee_id"::uuid;

  -- session
  ALTER TABLE "session" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "userId" SET DATA TYPE UUID USING "userId"::uuid,
  ALTER COLUMN "impersonatedBy" SET DATA TYPE UUID USING "impersonatedBy"::uuid;

  -- account
  ALTER TABLE "account" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "userId" SET DATA TYPE UUID USING "userId"::uuid;

  -- verification
  ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid;
  ```
- FK制約エラー発生時のフォールバック: 全FK制約をDROP → ALTER TYPE → ADD CONSTRAINT の3フェーズに変更
- コミットメッセージ: `refactor: 全テーブルのIDカラムをPostgreSQLネイティブUUID型に移行`

### Step 3: 動作確認・テスト実行

- 作業内容:
  - `pnpm test` で全テスト通過を確認
  - ドメイン層の `generateId()` が返す文字列がUUID型カラムに正常に格納されることを確認
  - better-authの認証フロー（`advanced.database.generateId`）が正常動作することを確認
- 備考:
  - `@db.Uuid` はTypeScript型を変更しない（引き続き `string`）ため、アプリケーションコードの変更は不要
  - `generateId()` はUUIDv7形式の文字列を返し、PrismaがUUID型への変換を自動処理する
  - raw SQLクエリは存在しない（grep確認済み）ため、アプリケーション側の影響なし

## 検証方法

1. `pnpm test` — 全テスト通過
2. `pnpm prisma db push --dry-run` や `prisma migrate diff` — スキーマとDBの差分がないこと
3. `pnpm dev` で起動し、ログイン・セッション管理が正常に動作すること
