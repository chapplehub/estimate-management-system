---
name: create-e2e-test
description: Playwright E2Eテスト作成パターン。Use when E2Eテストファイル(*.e2e.ts)の新規作成・修正時。ADR-0012/0017/0020 のルールを適用し、ファイル構成・実行方式・使用データ・命名規則の標準パターンを提供
user-invocable: true
---

# E2E Test Creation Patterns

設計判断の根拠は **ADR-0012**（DB環境）/ **ADR-0017**（セル特定）/ **ADR-0020**（構成・実行戦略）を参照。本スキルは実装者向けのチェックリスト。

## 1. 前提

- `pnpm e2e` で常にリシードされる → テストは常にシードデータ前提で開始する
- スキーマ変更時は `pnpm e2e:setup`
- Prisma クライアントでの直接 DB 操作は不可（ADR-0012 判断4）

## 2. ファイル構成（ADR-0020 判断4）

- **2ファイル基本**: `xxx-list.e2e.ts` + `xxx-crud.e2e.ts`
- **3ファイルに拡張**: detail 画面にナビゲーション系（パンくず / 親子リンク / 404）があれば `xxx-detail.e2e.ts` を分離
- **独立ファイル追加**: サブリソース操作（周辺商品モーダル、セット構成等）は `xxx-relations.e2e.ts` のように独立ファイル
- **300 行超で分離検討**（ADR-0020 判断5）: 順序は (1) 権限テスト分離 → (2) chain種別分離 → (3) データ次元分離

## 3. テスト種別と実行方式（ADR-0020 判断2）

| 種別 | DB状態変化 | 実行方式 | 使用データ |
|------|---|----------|------------|
| 成功系CRUD・ステータス変更 | あり | `test.describe.serial` | 新規データ（`xxx901`/`xxx902` をテスト内で作成） |
| ドメインエラー（FK制約・使用中・下位レコードあり等） | なし | serial 外で並列 | **独自シード**（`seed.e2e.ts` の `xxx9NN` 帯） |
| 簡易エラー（validation / duplicate / permission） | なし | serial 外で並列 | 共通シード |
| 検索・閲覧 | なし | serial 外で並列 | 共通シード |

**分類の判別基準**:

- **成功系** = DB に書き込みが成功する → テスト内で新規データ構築
- **ドメインエラー** = 関連データを読み込んで判定（FK / 使用中など）→ 独自シードを `seed.e2e.ts` に用意
- **簡易エラー** = UI / zod / 権限ミドルウェアで検出（DB 不変）→ 共通シード

## 4. serial chain の粒度（ADR-0020 判断1）

- **1 chain = 1 ライフサイクル × 1 関心事 × 1 データ区分**
- chain 最大 5 テスト
- ステータス管理（有効化 / 無効化）は独立 chain
- データ区分ごとに独立 chain（例: 個別商品 vs セット商品）
- 権限ごとに独立 `test.describe`

## 5. テストデータ命名規則

- **共通シード**: `xxx001`〜`xxx0XX` 帯（検索・閲覧・簡易エラー用）
- **テスト専用**: `xxx9NN` 帯
  - 成功系CRUD: `xxx901`（管理者用）/ `xxx902`（一般ユーザー用）をテスト内で作成
  - ドメインエラー用独自シード: `xxx9NN`（`seed.e2e.ts` に事前定義）
- エンティティ別の桁数例: `ROLE901`（7桁）/ `PRD901`（6桁）/ `C901`（4桁）/ `D901`（4桁）
- **CD にシナリオ名は埋め込まない**。代わりにテスト側で定数化して意味を明示する

```ts
const ROLE_HAS_CHILDREN = "ROLE901"; // seed.e2e.ts: 下位役割あり削除テスト用
```

## 6. 標準ヘルパー（各ファイルにコピペ）

**配置方針**: 各 e2e ファイルにそのままコピペして使う。共通ヘルパーファイルは作らない。
**型注釈**: `import { type Page, expect, test } from "@playwright/test"` の named import を標準とする。インライン型 `import("@playwright/test").Page` は使わない。

### ハイドレーション待機

```ts
import { type Page, expect, test } from "@playwright/test";

async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "xxx管理" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}
```

### ヘッダー名ベースのカラム特定（ADR-0017）

```ts
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}
```

## 7. セレクタ優先順位

1. `getByRole("heading" / "link" / "button", { name })` — アクセシビリティロール優先
2. `getByLabel("...")` — フォームフィールド
3. `#code-display` などの ID — 読み取り専用フィールドの検証のみ

## 8. 検索テストの粒度（ADR-0020 判断3）

- 検索ロジックが異なる条件（完全一致 / 部分一致 / ドロップダウン / ブール）は **個別テスト**
- 同ロジックを共有する条件群は **parametrize**（`for...of` でループ）
- **複合条件は必ず個別テスト**

## 9. CRUD serial の標準フロー

- **管理者 chain1（ライフサイクル）**: 作成 → 詳細確認 → 更新 → 削除
- **管理者 chain2（ステータス管理）**: 作成 → 無効化 → 有効化 → 削除（別データコード）
- **一般ユーザー chain（簡易・最小版）**: 作成 → 削除 の 2 ステップのみ（更新は含めない）
- **作成直後**: 一覧検索で新規レコードが**見つかる**ことを確認
- **削除直後**: 一覧検索で該当レコードが**見つからない**ことを確認

## 10. 成功 / エラー検証パターン

```ts
// 成功トースト
await expect(page.getByText("xxxを登録しました。")).toBeVisible({ timeout: 10000 });

// エラー表示（URL 不変）
await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
await expect(page).toHaveURL(/\/xxx\/new/);

// 404
const response = await page.goto("/xxx/NONEXIST");
expect(response?.status()).toBe(404);
```

## 11. 権限テスト（ADR-0020 判断5）

### 基本方針

- **権限差異がある機能のみ**両ユーザーでテスト
- 権限差異なし → 管理者テストのみ + 一般ユーザー簡易 chain 1 つ
- 一般ユーザーテスト: `test.describe` 内で `test.use({ storageState: "playwright/.auth/user.json" })` を記述（magic string のまま、定数化しない）

### 一般ユーザー簡易 chain（最小版）

- **作成 → 削除 の 2 ステップのみ**（更新は含めない）
- 目的: 一般ユーザーでも CRUD 最低限が通る回帰検知

### 権限エラーテスト（必須）

権限差異がある機能では以下を**必須**とする:

- 一般ユーザーが `/xxx/new` 等の管理者専用画面に直接アクセス → `/signin?reason=forbidden` リダイレクト
- 一般ユーザー閲覧画面で更新・削除ボタンが非表示

フロント側のナビ制御だけでなく、サーバ側認可チェックの回帰検知にもなる。

### ファイル分割（権限観点）

- 原則: `xxx-crud.e2e.ts` 同一ファイルに両ユーザーの `test.describe`
- **300 行超で分離検討**（凝集度で最終判断）
- 分離順序: (1) 権限テスト分離 `xxx-auth.e2e.ts` → (2) chain 種別分離 `xxx-status.e2e.ts` → (3) データ次元分離（例: `products-individual-crud.e2e.ts` / `products-set-crud.e2e.ts`）

## 12. 詳細画面の dt+dd 検証

```ts
const field = (label: string) => page.locator("dt", { hasText: label }).locator("+ dd");
await expect(field("商品コード")).toContainText(TEST_CODE);
```

## 13. シードデータ追加（ADR-0020 判断2）

- **独自シード追加の対象**: ドメインエラーテスト（FK制約 / 使用中 / 下位レコードあり等）
- **追加ルール**:
  - CD は `xxx9NN` 帯（例: `ROLE901`, `C901`）
  - `seed.e2e.ts` 内にコメントでシナリオを明示（例: `// ROLE901/902: 下位役割あり削除テスト用`）
  - `name` / `description` に `E2E専用_<用途>` プレフィックスを付ける
- **既存データ構造は変更しない**（Issue #250 原則）
- **failure-only テスト用**（DB 不変が前提）。成功系テストで書き換える用途には使わない
- 汎用パターンとして複数テストで共有 OK（1 テスト専用にしない）

## 14. 実行コマンド

- `pnpm e2e` — 全テスト（リシード込み）
- `pnpm e2e:setup` — DB 初期化（スキーマ変更時）
- `pnpm e2e:seed` — リシードのみ
- `pnpm e2e -- --grep "xxx"` — 特定パターンのみ実行

## 15. chain 途中失敗時の対応

テストデータが残留した場合は `pnpm e2e:seed` で再シード。

## 16. 既存実装の参照

| 実例 | パターン |
|---|---|
| `src/app/(features)/roles/roles-*.e2e.ts` | 2ファイル分割（権限差異あり） |
| `src/app/(features)/customers/customers-*.e2e.ts` | 3ファイル分割（detail 分離） |
| `src/app/(features)/products/products-*.e2e.ts` | 4ファイル分割（relations 独立） |
| `src/app/(features)/delivery-locations/delivery-locations-*.e2e.ts` | 3ファイル分割（権限差異なし・簡易 chain） |
