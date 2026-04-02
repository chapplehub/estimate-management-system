# Issue #179: Position, Role, EmployeeRole テーブルに created_at / updated_at カラムを追加する — 実装計画

## 概要
Position, Role, EmployeeRole の3テーブルに `created_at` / `updated_at` タイムスタンプカラムを追加する。
他テーブル（Employee, Department 等）と同様のパターンに統一する。

## ステップ

### Step 1: Prisma スキーマに createdAt / updatedAt フィールドを追加
- 対象ファイル: `prisma/schema.prisma`
- 作業内容:
  - Position モデルに `createdAt` / `updatedAt` フィールドを追加
  - Role モデルに `createdAt` / `updatedAt` フィールドを追加
  - EmployeeRole モデルに `createdAt` / `updatedAt` フィールドを追加
  - Employee モデルと同じパターン（`@default(now())`, `@updatedAt`, `@map()`）を使用
- コミットメッセージ: feat: Position, Role, EmployeeRole に createdAt/updatedAt フィールドを追加

### Step 2: マイグレーション作成・適用 & Prisma Client 再生成
- 対象ファイル: `prisma/migrations/` (新規マイグレーション)
- 作業内容:
  - `pnpm db:migrate` でマイグレーション作成・適用
  - `pnpm db:generate` で Prisma Client 再生成
- コミットメッセージ: feat: createdAt/updatedAt カラム追加のマイグレーションを作成

### Step 3: 検証（lint & テスト）
- 作業内容:
  - `pnpm lint` で lint チェック
  - `pnpm test` でテスト実行
  - 問題があれば修正
- コミットメッセージ: (修正が必要な場合のみ)
