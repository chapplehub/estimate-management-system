# Issue #260 実装計画

## 目的

`products-crud.e2e.ts` を `create-e2e-test` スキル（§2 / §4 / §9 / §11）に準拠させる。
chain 粒度を再編し、relations 機能のテストを `products-relations.e2e.ts` に集約する。

## 調査結果（前提となる事実）

| 観点 | 事実 | 根拠 |
|------|------|------|
| `/products/new` の認可 | proxy の `adminRoutes` に **含まれない**（`employees/new` 等とは異なる） | `src/proxy.ts` |
| 商品作成の認可 | `createProduct` server action が `verifyAdmin()` を呼び、非管理者は `/signin?reason=forbidden` へ redirect | `products/new/actions.ts`, `verifyAuthentication.ts` |
| 一覧の「新規登録」リンク | `isAdmin(session)` で出し分け（一般ユーザー非表示） | `products/page.tsx` |
| 一覧の権限テスト | 「新規登録ボタン非表示」は **list e2e で既存** | `products-list.e2e.ts:108` |
| relations 追加カバレッジ | crud の「周辺商品を設定できる」は relations の「商品コードで検索して...保存できる」の **部分集合** | 両ファイル比較 |

→ 商品は **権限差異あり機能**。§11 の一般ユーザー簡易 chain（作成→削除）は
一般ユーザーが商品を作成できないため **適用不可** → 省略（根拠コメント明記）。`employees-crud.e2e.ts` の前例に準拠。

## 変更後の構成

### `products-crud.e2e.ts`

`test.describe("商品CRUD（管理者）")`

1. `test.describe.serial("ライフサイクル - 個別商品")` … §9 chain1（4 ステップ）
   - 個別商品を作成できる（`PRD901`）
   - 商品詳細を確認できる
   - 商品を編集できる
   - 商品を削除できる
2. `test.describe.serial("ステータス管理 - 個別商品")` … §9 chain2（4 ステップ・**別データコード `PRD903`**）
   - 個別商品を作成できる（`PRD903`）
   - 商品を無効化できる
   - 商品を有効化できる
   - 商品を削除できる
3. `test.describe.serial("作成・削除テスト - セット商品")` … 現状維持（3 ステップ・`PRD902`）
4. 簡易エラー（serial 外・並列）: 重複コード / 重複名 / 404 … 現状維持

`test.describe("商品（一般ユーザー）")`
- §11 省略根拠コメントを記載（`createProduct` が `verifyAdmin()` 必須のため簡易 chain 省略）
- 一般ユーザーは商品詳細を閲覧できるが編集ボタンが見えない（現状維持）
- 一般ユーザーは編集画面にアクセスできない（現状維持）
- **追加**: 一般ユーザーが商品作成を実行すると `/signin?reason=forbidden` へ redirect（§11 必須・サーバ認可回帰）

### `products-relations.e2e.ts`

既存の「周辺商品の追加・編集・削除」chain は維持。以下を追加:

- `test.describe.serial("参照されている商品の無効化ダイアログ")` … 1 chain = 1 関心事（5 ステップ）
  1. テスト用親商品を作成する（`PRD803`）
  2. テスト用参照先商品を作成する（`PRD804`）
  3. `PRD803` の周辺商品に `PRD804` を紐付ける
  4. 参照されている `PRD804` の無効化で置換ダイアログが表示される（参照元 `PRD803` 表示・閉じる）
  5. テストデータを削除する（`PRD803` → `PRD804` の順で FK 回避）

→ crud の「管理者が周辺商品を設定できる」は relations が上位互換のため **削除**（コピーしない）。

## 逸脱記録対象

- issue 文言は「周辺商品追加テストを移動」だが、relations 側が上位互換カバレッジを持つため
  literal なコピーはせず crud から削除する。`deviations.md` に記録する。

## 検証

- `pnpm lint`
- `pnpm e2e`（リシード込み・全件）

## skill 準拠チェック

- [ ] 全 chain が §4（最大 5 / 1 ライフサイクル × 1 関心事 × 1 データ区分）準拠
- [ ] §9 chain1 / chain2 の標準フロー（別データコード）
- [ ] relations 機能が `products-relations.e2e.ts` に集約（§2）
- [ ] §11 一般ユーザー簡易 chain の扱いを根拠付きで判断
