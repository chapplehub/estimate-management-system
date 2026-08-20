# Issue #194: テスト並列実行時の部署マスタupsertレースコンディションの修正 -- 実装計画

## 概要

Vitestの並列実行時に複数テストファイルが同時に `prisma.department.upsert({ update: {} })` を実行し、unique constraint violation が発生するフレーキーテスト問題を修正する。共通ヘルパー `ensureTestDepartment()` を作成し、全9ファイルのボイラープレートを置換する。

## ステップ

### Step 1: 共通ヘルパー関数 `ensureTestDepartment` の作成

- 対象ファイル: `src/server/__tests__/helpers/ensureTestDepartment.ts`（新規作成）
- 作業内容:
  - `ensureTestDepartment()` 関数を作成
  - `update: { name: "テスト部署" }` で ON CONFLICT DO UPDATE を保証（方針A）
  - try-catch で findUniqueOrThrow にフォールバック（方針B）
- コミットメッセージ: feat: テスト用共通ヘルパー ensureTestDepartment を作成

### Step 2: 全9テストファイルのボイラープレートを `ensureTestDepartment()` に置換

- 対象ファイル: 9つのテストファイル（影響範囲に記載）
- 作業内容:
  - 各ファイルの beforeEach 内の department upsert コードを `ensureTestDepartment()` 呼び出しに置換
  - 不要になった `generateId` インポートがあれば削除（他で使っていない場合のみ）
- コミットメッセージ: fix: 部署マスタupsertのレースコンディションを修正 (#194)

### Step 3: lint & テスト検証

- 作業内容: `pnpm lint` と `pnpm test` を実行して検証
- コミットメッセージ: （修正が必要な場合のみ）fix: lint/test修正
