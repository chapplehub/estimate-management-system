# Issue #261 実装計画

## 目的

`src/app/(features)/customers/customers-crud.e2e.ts` を `create-e2e-test` スキル
（§4 / §9 / §13）に準拠させる。serial chain の粒度を再編し、ドメインエラー
failure-only テスト用の独自シードを `prisma/seed-e2e.ts` に分離する。

## 調査結果（前提となる事実）

| 観点 | 事実 | 根拠 |
|------|------|------|
| 現状 chain | `作成・更新・ステータス変更・削除テスト` に 6 ステップ（作成→詳細→更新→無効化→有効化→削除） | `customers-crud.e2e.ts:13-168` |
| skill §4 上限 | chain 最大 5 テスト・ステータス管理は独立 chain | SKILL.md §4 |
| 既存テスト専用CD | 管理者 `CUST901` / 一般 `CUST902`（テスト内作成） | `customers-crud.e2e.ts:4,8` |
| status chain CD 前例 | products は chain2 用に `PRD903` を別CDで採用 | `products-crud.e2e.ts:8` |
| ドメインエラーテスト | `納品先がある得意先は削除できない` が共通シード `C001`（D001/D002 保有）を借用 | `customers-crud.e2e.ts:170-182` |
| seed 構造 | `CUSTOMERS` 配列に `deliveryLocations[]` をネスト。`seedCustomersAndDeliveryLocations()` が Company+Customer / Company+DeliveryLocation を生成 | `seed-e2e.ts:172-306,472-544` |
| skill §13 | 独自シード CD は `xxx9NN` 帯・`name`/`description` に `E2E専用_` プレフィックス・シナリオコメント・既存構造は不変 | SKILL.md §13 |

## 変更後の構成

### `prisma/seed-e2e.ts`

`CUSTOMERS` 配列末尾（C005 の後）に追記（既存 C001〜C005 は不変）:

- `C901`（`E2E専用_納品先あり削除テスト用得意先`）+ 配下 `D901`
  （`E2E専用_納品先あり削除テスト用納品先`）
- `// C901/D901: E2E専用_納品先あり削除テスト用（skill §13 / Issue #261）` コメント付与

### `customers-crud.e2e.ts`

定数追加:
- `TEST_STATUS_CUSTOMER_CD = "CUST903"` / `TEST_STATUS_CUSTOMER_NAME`
- `CUSTOMER_HAS_DELIVERY = "C901"`（seed 由来であることをコメント明示）

`test.describe("得意先CRUD（管理者）")`:

1. `test.describe.serial("ライフサイクル")` … §9 chain1（4 ステップ）
   - 新規得意先を作成できる（`CUST901`）
   - 得意先詳細を確認できる
   - 得意先情報を更新できる
   - 得意先を削除できる
2. `test.describe.serial("ステータス管理")` … §9 chain2（4 ステップ・別CD `CUST903`）
   - ステータス管理用の得意先を作成できる
   - 得意先を無効化できる
   - 得意先を有効化できる
   - 得意先を削除できる
3. `test("納品先がある得意先は削除できない")` … `C901` を参照（並列・DB 不変）
4. `test("重複する取引先コードでエラーが表示される")` … 既存維持

`test.describe("得意先CRUD（一般ユーザー）")`: 既存維持（変更なし）

## 完了条件

- 各 chain のステップ数 ≤ 5（§4）
- ドメインエラー failure-only テストが独自シード `C901`/`D901` を使用（§13）
- 共通シード `C001` を失敗系テストで借用しない
- `pnpm e2e` グリーン
