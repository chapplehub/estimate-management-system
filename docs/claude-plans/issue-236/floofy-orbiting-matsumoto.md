# Issue #236: 周辺商品モーダル E2Eテスト作成

## 概要

SelectionModal による周辺商品追加機能の実装(#236)に伴い、以下を行う:
1. `products-crud.e2e.ts` の壊れた周辺商品テストを新UI(SelectionModal)に対応修正
2. `products-relations.e2e.ts` を新規作成し、モーダルの包括的なE2Eテストを実装

テストデータ戦略: seedデータへの副作用を避けるため、テスト内でUI経由で専用商品(PRD800-802)を作成する。E2Eテストは毎回 seed-e2e で初期化されるためクリーンアップは不要。

## 設計判断

なし（既存E2Eパターンに準拠）

## ステップ

### Step 1: products-crud.e2e.ts の壊れたテストを修正

- 対象ファイル: `src/app/(features)/products/products-crud.e2e.ts`
- 作業内容:
  - テスト「管理者が周辺商品を設定できる」(75-97行目)を SelectionModal UI に対応
  - 旧: `getByPlaceholder("例: PRD001").fill("PRD002")` → `getByRole("button", { name: "追加" })`
  - 新: "商品を追加" → モーダル → `#modal-search-code` に "PRD002" → "検索" → チェックボックス → "1件を追加" → "保存"
  - 後続テスト（無効化ダイアログ）の依存関係を壊さないこと
- コミットメッセージ: `fix(e2e): 周辺商品テストをSelectionModal UIに対応させる`

### Step 2: products-relations.e2e.ts を新規作成

- 対象ファイル: `src/app/(features)/products/products-relations.e2e.ts`（新規）
- 作業内容:
  - `test.describe.serial` で以下のテストフローを実装

#### テスト一覧

| # | テスト名 | 内容 |
|---|---------|------|
| 1 | テスト用の個別商品を作成する (PRD800) | UI経由でINDIVIDUAL商品を作成（周辺商品の親） |
| 2 | テスト用の個別商品を作成する (PRD801) | UI経由でINDIVIDUAL商品を作成（関連先A） |
| 3 | テスト用の消耗品を作成する (PRD802) | UI経由でCONSUMABLE商品を作成（関連先B） |
| 4 | 周辺商品の初期状態が正しい | 空状態の表示確認、モーダルの初期表示確認（検索前メッセージ、0件ボタンdisabled） |
| 5 | 商品コードで検索して商品を選択・追加できる | PRD801を検索→チェック→追加、テーブル表示・数量1を確認 |
| 6 | 追加の商品を検索して追加できる | PRD802を名前検索+区分フィルターで追加、両商品がテーブルに表示 |
| 7 | 保存して周辺商品が永続化される | 保存→リダイレクト→トースト確認→再度relationsページで永続化確認 |
| 8 | 追加済み商品がモーダルから除外される | "PRD80"で検索→PRD800(自身),801,802が結果に出ないことを確認 |
| 9 | 数量を変更して保存できる | PRD801の数量を3に変更→保存→永続化確認 |
| 10 | 周辺商品を個別に削除できる | PRD801削除→PRD802削除→空状態確認→保存 |

#### 主要セレクタ

| 要素 | セレクタ |
|------|---------|
| モーダルタイトル | `getByRole("heading", { name: "商品を選択" })` |
| 検索コード入力 | `locator("#modal-search-code")` |
| 検索名前入力 | `locator("#modal-search-name")` |
| 検索区分選択 | `locator("#modal-search-category")` |
| 検索ボタン | `getByRole("button", { name: "検索" })` |
| N件を追加ボタン | `getByRole("button", { name: /\d+件を追加/ })` |
| 行のチェックボックス | `locator("tr", { hasText: "PRD801" }).locator("input[type='checkbox']")` |
| 行の数量入力 | `locator("tr", { hasText: "PRD801" }).locator("input[type='number']")` |
| 行の削除ボタン | `locator("tr", { hasText: "PRD801" }).getByRole("button", { name: "削除" })` |

#### ヘルパー関数

商品作成を DRY にする `createProduct` ローカルヘルパーを定義:
```typescript
async function createProduct(page: Page, code: string, name: string, category: string, unit: string) {
  await page.goto("/products/new");
  await expect(page.getByRole("heading", { name: "新規商品登録" })).toBeVisible();
  await page.getByLabel("商品コード").fill(code);
  await page.getByLabel("商品名").fill(name);
  await page.getByLabel("商品区分").selectOption(category);
  await page.getByLabel("単位").selectOption(unit);
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page.getByText("商品を登録しました。")).toBeVisible({ timeout: 10000 });
}
```

- コミットメッセージ: `test(e2e): 周辺商品モーダルの包括的E2Eテストを追加`

## 検証

```bash
# Step 1 の検証: 既存テストが通ること
pnpm e2e --grep "周辺商品を設定できる"

# Step 2 の検証: 新テストが通ること
pnpm e2e --grep "周辺商品モーダル"

# 全体の検証: 商品関連テスト全体がパスすること
pnpm e2e --grep "商品"
```
