# Issue #242: E2Eテストのテーブルセル特定を nth-child ハードコードからヘッダー名ベースに統一する — 実装計画

## 概要

ADR-0017 で採用された「ヘッダー名ベース」のカラム特定方式を、既存の一覧テスト3ファイルに適用する。
`td:nth-child(N)` のハードコードを `getColumnIndex()` ヘルパーによる動的取得に置き換える。

## 参考パターン

`customers-list.e2e.ts` の `getColumnIndex()` ヘルパーを標準パターンとして採用:

```typescript
async function getColumnIndex(page: import("@playwright/test").Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}
```

## ステップ

### Step 1: products-list.e2e.ts のリファクタリング

- 対象ファイル: `src/app/(features)/products/products-list.e2e.ts`
- 作業内容:
  - `getColumnIndex()` ヘルパー関数を追加
  - L58: `td:nth-child(3) span` → ヘッダー名「商品区分」で動的取得
  - L75: `td:nth-child(5) span` → ヘッダー名「状態」で動的取得
- コミットメッセージ: refactor: products-list.e2e.ts の nth-child をヘッダー名ベースに変更

### Step 2: departments-list.e2e.ts のリファクタリング

- 対象ファイル: `src/app/(features)/departments/departments-list.e2e.ts`
- 作業内容:
  - `getColumnIndex()` ヘルパー関数を追加
  - L72: `td:nth-child(5) span` → ヘッダー名「状態」で動的取得
- コミットメッセージ: refactor: departments-list.e2e.ts の nth-child をヘッダー名ベースに変更

### Step 3: roles-list.e2e.ts のリファクタリング

- 対象ファイル: `src/app/(features)/roles/roles-list.e2e.ts`
- 作業内容:
  - `getColumnIndex()` ヘルパー関数を追加
  - L36: `td:nth-child(2)` → ヘッダー名「役割名」で動的取得
  - L67: `td:nth-child(3)` → ヘッダー名「役職」で動的取得
- コミットメッセージ: refactor: roles-list.e2e.ts の nth-child をヘッダー名ベースに変更
