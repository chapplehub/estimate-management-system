# Issue #227: 役割E2Eテストを CRUD 直列化方式にリファクタリング — 実装計画

## 概要

`roles-create.e2e.ts` と `roles-detail.e2e.ts` を `roles-crud.e2e.ts` に統合し、副作用のあるテスト（作成→更新→削除）を `test.describe.serial` で直列実行する。#225 で従業員テストに適用済みの CRUD 直列化パターン（ADR-0012 判断4）を横展開する。

### 現状の課題
- `roles-create.e2e.ts`: `afterEach` でUI経由の削除クリーンアップ → 失敗時にゴミデータ蓄積
- `roles-detail.e2e.ts`: `beforeAll` + `createTestRole` ヘルパーでデータ準備 → create 操作自体の検証なし
- テストデータが分散（ROLE901 / ROLE902）

## 設計判断

### 動的上位役割フィルタリングテストの配置
- A. 「役割CRUD（管理者）」describe 内に入れる（employees-crud.e2e.ts と完全一致の構造）
- B. 独立した describe ブロックとして維持する
- 推奨: B（フィルタリングはCRUD操作とは異なるUIロジックテストであり、現行ファイルと同じ独立ブロックを維持する方が可読性が高い）

### 更新テストの上位役割変更方法
- Create テストで `selectOption({ index: 1 })` を使用するため、Update テストでは `selectOption({ index: 2 })` に変更する
- 上位役割の select value は UUID（非決定的）のため、更新後の値検証はトースト表示で代替する（employees-crud.e2e.ts と同じ方針）

## ステップ

### Step 1: roles-crud.e2e.ts を作成
- 対象ファイル: `src/app/(features)/roles/roles-crud.e2e.ts`（新規作成）
- 作業内容:
  - 両ファイルの全テストを統合した新ファイルを作成
  - `TEST_ROLE_CD = "ROLE901"` に統一
  - `afterEach` / `beforeAll` / `createTestRole` ヘルパーは使用しない
  - 更新テストを `name` + `superiorRoleId` の2フィールド変更に拡張
- コミットメッセージ: `test: 役割E2Eテストを roles-crud.e2e.ts に統合 (#227)`

### Step 2: 旧ファイルを削除
- 対象ファイル:
  - `src/app/(features)/roles/roles-create.e2e.ts`（削除）
  - `src/app/(features)/roles/roles-detail.e2e.ts`（削除）
- 作業内容:
  - 両ファイルを削除する
- コミットメッセージ: `test: 統合済みの旧役割テストファイルを削除 (#227)`

### Step 3: E2Eテスト実行・動作確認
- 対象: `src/app/(features)/roles/` 配下の全テスト
- 作業内容:
  - `pnpm exec playwright test src/app/\(features\)/roles/roles-crud.e2e.ts` で新ファイル実行
  - `pnpm exec playwright test src/app/\(features\)/roles/` で全役割テスト実行（roles-list.e2e.ts への影響がないことを確認）
- コミットメッセージ: なし（確認のみ）

---

## roles-crud.e2e.ts のファイル構造

```
import { expect, test } from "@playwright/test";

const TEST_ROLE_CD = "ROLE901";

test.describe("役割CRUD（管理者）", () => {
  test.describe.serial("作成・更新・削除テスト", () => {
    test("管理者が新規役割を作成できる")        // roles-create.e2e.ts から移植
    test("管理者が役割情報を更新できる")        // roles-detail.e2e.ts から移植 + 複数フィールド変更に拡張
    test("管理者が未使用の役割を削除できる")    // roles-detail.e2e.ts から移植（ROLE901 に変更）
  })

  // 副作用のない並列テスト
  test("重複する役割コードでエラーが表示される")     // roles-create (ROLE001 seed使用)
  test("役割名が未入力でバリデーションエラーが表示される") // roles-create
  test("キャンセルボタンで一覧に戻れる")              // roles-create
  test("使用中の役割は削除できない")                  // roles-detail (ROLE009 seed使用)
  test("下位役割がある役割は削除できない")            // roles-detail (ROLE001 seed使用)
  test("存在しない役割コードで404が表示される")       // roles-detail (ROLE999使用)
})

test.describe("動的上位役割フィルタリング（管理者）", () => {
  test("役職選択で上位役割候補がフィルタリングされる")  // roles-create そのまま
  test("役職変更で上位役割の選択がリセットされる")      // roles-create そのまま
  test("最上位役職では上位役割が表示されない")          // roles-create そのまま
  test("本部長選択で社長の役割が上位候補になる")        // roles-create そのまま
})

test.describe("役割（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" })
  test("一般ユーザーは新規作成画面にアクセスできない")  // roles-create
  test("一般ユーザーは閲覧のみ")                       // roles-detail
})
```

## 更新テストの拡張内容

現行（roles-detail.e2e.ts）: `name` のみ変更

```typescript
// 現行
const nameField = page.getByLabel("役割名");
await nameField.clear();
await nameField.fill("E2E更新テスト役割");
await page.getByRole("button", { name: "更新" }).click();
```

拡張後: `name` + `superiorRoleId` の2フィールドを変更

```typescript
// 拡張後
const nameField = page.getByLabel("役割名");
await nameField.clear();
await nameField.fill("E2E更新テスト役割");

// 上位役割を変更（create時に index:1 → update時に index:2）
await page.getByLabel("上位役割").selectOption({ index: 2 });

await page.getByRole("button", { name: "更新" }).click();
```

## 除去するアンチパターン

| アンチパターン | 元ファイル | 代替 |
|---|---|---|
| `afterEach` でのUI削除クリーンアップ | roles-create.e2e.ts L8-15 | serial の delete テストがクリーンアップを兼ねる |
| `createTestRole` ヘルパー関数 | roles-detail.e2e.ts L9-22 | serial の create テストがセットアップを兼ねる |
| `beforeAll` でのブラウザコンテキスト手動作成 | roles-detail.e2e.ts L27-38 | 不要（serial の各テストが自動で page を受け取る） |
| テストデータコード分散（ROLE901 / ROLE902） | 両ファイル | `ROLE901` に統一 |

## 変更対象外

- `src/app/(features)/roles/roles-list.e2e.ts` — 参照系テストのため変更不要

## 検証方法

1. `pnpm exec playwright test src/app/\(features\)/roles/roles-crud.e2e.ts` — 新ファイルの全テストがパスすること
2. `pnpm exec playwright test src/app/\(features\)/roles/` — roles-list.e2e.ts を含む全役割テストがパスすること
3. 旧ファイル（roles-create.e2e.ts, roles-detail.e2e.ts）が存在しないこと
