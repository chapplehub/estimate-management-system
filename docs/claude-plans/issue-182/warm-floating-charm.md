# Issue #182: IDの生成仕様・フォーマット規格の検討 — 実装計画

## 概要

プロジェクト全体のID生成を CUID2 (`@paralleldrive/cuid2`) から **UUIDv7** (`uuid` パッケージ) に移行する。
ドメインエンティティおよび better-auth 管理テーブルの両方を対象とし、ID生成を共有ユーティリティ関数 `generateId()` に集約する。

**動機:**
- CUID2 はタイムスタンプベースのソートを意図的に排除しており、時系列順のソートが不可能
- PostgreSQL にネイティブ UUID 型が存在するが、CUID は独自フォーマットで DB との相性が悪い
- UUIDv7 は RFC 9562 標準で、先頭48ビットにミリ秒タイムスタンプを持ち、生成順 ≒ 辞書順が保証される

## 設計判断

### Prismaカラム型: String維持 vs PostgreSQLネイティブUUID型

- A. `String @id` を維持（値のフォーマットのみ UUIDv7 に変更）
- B. PostgreSQL ネイティブ `UUID` 型に変更（`@db.Uuid` 指定）
- **決定: A**（ネイティブUUID型への移行は #188 で対応）

### ID Value Object の導入

- A. 今回のスコープで `EntityId` 等の型付き Value Object を導入する
- B. 別 Issue に分離し、今回は ID 生成方式の変更のみに集中する
- **決定: B**（Value Object 導入は #189 で対応）

### better-auth テーブルのID生成

- A. ドメインテーブルのみ UUIDv7 に変更し、auth テーブルはデフォルトのまま
- B. `advanced.database.generateId` コールバックで auth テーブルも UUIDv7 に統一
- **決定: B**（プロジェクト全体でIDフォーマットを一貫させる）

### 既存データの扱い

- 開発環境のみのため `prisma migrate reset` + 再シードで対応（本番データなし）

## ステップ

### Step 1: UUIDv7 ID生成ユーティリティの追加

- 対象ファイル:
  - `src/server/shared/generateId.ts`（新規作成）
  - `src/server/shared/__tests__/generateId.test.ts`（新規作成）
  - `package.json`（`uuid` 追加）
- 作業内容:
  - `pnpm add uuid` を実行
  - `generateId()` 関数を作成（`uuid` パッケージの `v7()` をラップ）
  - ユニットテスト作成: UUIDv7 フォーマット検証、一意性検証、時間順ソート可能性検証
- コミットメッセージ: `feat: UUIDv7のID生成ユーティリティ関数を追加`

### Step 2: エンティティのID生成を移行

- 対象ファイル（5ファイル）:
  - `src/server/subdomains/employee/domain/entities/Employee.ts`
  - `src/server/subdomains/customer/domain/entities/Customer.ts`
  - `src/server/subdomains/department/domain/entities/Department.ts`
  - `src/server/subdomains/role/domain/entities/Role.ts`
  - `src/server/subdomains/delivery-location/domain/entities/DeliveryLocation.ts`
- 作業内容:
  - `import { createId } from "@paralleldrive/cuid2"` → `import { generateId } from "@server/shared/generateId"` に変更
  - `createId()` → `generateId()` に置換
  - コメント内の「CUID」→「UUIDv7」に更新
- コミットメッセージ: `refactor: エンティティのID生成をCUID2からUUIDv7に移行`

### Step 3: テストファイルのID生成を移行

- 対象ファイル（22ファイル）:
  - `src/server/subdomains/employee/**/__tests__/*.test.ts`（10ファイル）
  - `src/server/subdomains/department/**/__tests__/*.test.ts`（8ファイル）
  - `src/server/subdomains/customer/**/__tests__/*.test.ts`（2ファイル）
  - `src/server/subdomains/delivery-location/**/__tests__/*.test.ts`（2ファイル）
- 作業内容:
  - `import { createId } from "@paralleldrive/cuid2"` → `import { generateId } from "@server/shared/generateId"` に変更
  - `createId()` → `generateId()` に置換
  - ※ `reconstruct()` で使われるハードコードID（`"test-id"` 等）はそのまま維持
- コミットメッセージ: `test: テストファイルのID生成をCUID2からUUIDv7に移行`

### Step 4: シードスクリプトの移行

- 対象ファイル:
  - `prisma/seed.ts`
- 作業内容:
  - `import { createId } from "@paralleldrive/cuid2"` → `import { generateId } from "../src/server/shared/generateId"` に変更（seed.ts は tsx 実行のため相対パス使用）
  - `createId()` → `generateId()` に置換
- コミットメッセージ: `chore: シードスクリプトのID生成をCUID2からUUIDv7に移行`

### Step 5: better-auth のID生成を UUIDv7 に統一

- 対象ファイル:
  - `src/server/shared/auth/better-auth/auth.ts`
- 作業内容:
  - `import { generateId } from "@server/shared/generateId"` を追加
  - `advanced.database.generateId` コールバックを設定し、auth テーブル（User/Session/Account/Verification）のID生成も UUIDv7 に統一
- コミットメッセージ: `feat: better-authのID生成をUUIDv7に統一`

### Step 6: CUID2パッケージ削除・スキーマコメント更新

- 対象ファイル:
  - `package.json`（`@paralleldrive/cuid2` 削除）
  - `prisma/schema.prisma`（コメント更新）
  - `learning/prisma-id-generation.md`（内容更新）
- 作業内容:
  - `pnpm remove @paralleldrive/cuid2` を実行
  - スキーマ内の全 `// ドメイン層でCUID生成` コメントを `// ドメイン層でUUIDv7生成` に変更
  - `learning/prisma-id-generation.md` の内容を UUIDv7 ベースに更新
  - プロジェクト全体で `@paralleldrive/cuid2` の残存importがないことを grep で確認
- コミットメッセージ: `chore: CUID2パッケージを削除しスキーマコメント・学習ドキュメントを更新`

### Step 7: テスト実行・動作確認

- 作業内容:
  - `pnpm test` で全テスト通過を確認
  - `pnpm build` でビルド成功を確認
  - `pnpm lint` でリント通過を確認
  - 失敗があれば修正
- コミットメッセージ: （修正がある場合のみ）`fix: UUIDv7移行に伴うテスト修正`

## 検証方法

1. **ユニットテスト**: `generateId()` が UUIDv7 フォーマット（`/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`）に準拠することを確認
2. **既存テスト**: `pnpm test` で全テスト（ドメイン・アプリケーション・インフラ）が通過
3. **ビルド**: `pnpm build` が成功
4. **DB確認**: `prisma migrate reset` + シード後、DB内のIDがUUIDv7フォーマットであることを目視確認
