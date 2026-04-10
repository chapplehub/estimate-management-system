# Issue #209: 商品詳細・作成・編集画面および関連機能の実装 — 実装計画

## 概要

商品マスタのプレゼンテーション層（詳細・作成・編集画面、周辺商品設定、セット構成設定、無効化入替ポップアップ、Server Actions、E2Eテスト）を実装する。

- バックエンド（Domain / Application / Infrastructure）は #204 で整備済み
- 商品一覧画面は #208/#230 で実装済み
- 既存パターン（従業員・部門CRUD）を踏襲する

### ルート構成
| URL | 画面 |
|-----|------|
| `/products` | 一覧（実装済み） |
| `/products/new` | 作成 |
| `/products/[productCd]` | 詳細 |
| `/products/[productCd]/edit` | 編集 |
| `/products/[productCd]/relations` | 周辺商品設定（別ページ） |
| `/products/[productCd]/components` | セット構成設定（別ページ） |

### 権限
- 閲覧: 全認証ユーザー（`verifySession()`）
- 作成・編集・削除・有効化・無効化: 管理者のみ（`verifyAdmin()`）

## 設計判断

### QueryService の `findByCode` 追加
- A. `ProductQueryService` に `findByCode(code)` を追加し、`GetProductByCodeQuery` クラスを新設（`GetEmployeeByEmployeeCdQuery` パターン踏襲）
- B. `search({ code })` で部分一致検索して結果から完全一致を抽出
- 推奨: A（search は `contains` 部分一致のため、`PRD001` で `PRD0011` もヒットする。コードベースURL解決には完全一致が必要）

### 無効化入替の参照チェック用クエリ
- A. `ProductQueryService` に `findReferencingProducts(id)` を追加
- B. サーバーページで直接リポジトリを使う
- 推奨: A（QueryService 経由で DTO を返すのが DDD パターンに合致）

### 編集画面の分離
- 従業員は詳細ページ内に更新フォームを配置しているが、商品は Issue の要件通り `/products/[productCd]/edit` を別ページとして実装する
- 理由: 詳細画面に周辺商品・セット構成・無効化入替など複雑な機能があり、編集フォームを分離した方が画面の責務が明確になる

### ダイアログコンポーネント
- shadcn Dialog（`@radix-ui/react-dialog`）を追加する（既存 shadcn コンポーネント: badge, button, sonner, label, card, input）
- 無効化入替ポップアップで使用

## ステップ

### Step 1: QueryService 拡張（findByCode + findReferencingProducts）
- 対象ファイル:
  - `src/server/subdomains/product/application/queries/ProductQueryService.ts`
  - `src/server/subdomains/product/infrastructure/queries/PrismaProductQueryService.ts`
  - `src/server/subdomains/product/application/queries/GetProductByCodeQuery.ts`（新規）
  - `src/server/subdomains/product/application/queries/GetProductReferencesQuery.ts`（新規）
  - `src/server/subdomains/product/application/factories/productQueryFactory.ts`
  - `src/server/subdomains/product/application/factories/index.ts`
- 作業内容:
  - `ProductQueryService` に `findByCode(code: string): Promise<ProductDTO | null>` 追加
  - `ProductQueryService` に `findReferencingProducts(id: string): Promise<ProductDTO[]>` 追加
  - `PrismaProductQueryService` に両メソッド実装（`findByCode`: `prisma.product.findUnique({ where: { code } })`、`findReferencingProducts`: 周辺商品 or セット構成で参照している商品を取得）
  - `GetProductByCodeQuery` クラス作成（`GetProductByIdQuery` パターン踏襲）
  - `GetProductReferencesQuery` クラス作成
  - ファクトリ関数 `getProductByCodeQueryFactory()`、`getProductReferencesQueryFactory()` 追加
- コミットメッセージ: feat(product): add findByCode and findReferencingProducts to ProductQueryService

### Step 2: リダイレクト理由 + 共通 Zod スキーマ + ラベル定数
- 対象ファイル:
  - `src/shared/constants/redirect-reasons.ts`
  - `src/app/_components/redirect-reason-toast.tsx`
  - `src/app/(features)/products/_shared/schema.ts`（新規）
  - `src/app/(features)/products/_shared/labels.ts`（新規）
- 作業内容:
  - `REDIRECT_REASON` に商品用定数追加（PRODUCT_CREATED / UPDATED / DELETED / ACTIVATED / DEACTIVATED）
  - `FLASH_MESSAGES` に対応メッセージ追加
  - `_shared/schema.ts`: `productBaseSchema`（name, unit, description?, note?, costPrice?）、`productCodeSchema`（英数字 1-50桁）、`productCategorySchema`（INDIVIDUAL/CONSUMABLE/SET）を定義
  - `_shared/labels.ts`: `CATEGORY_LABELS`、`UNIT_LABELS` を定義（一覧 columns.tsx の `CATEGORY_LABELS` もここから参照するようリファクタ）
- コミットメッセージ: feat(product): add redirect reasons, base schema, and label constants

### Step 3: 商品作成画面
- 対象ファイル:
  - `src/app/(features)/products/new/page.tsx`（新規）
  - `src/app/(features)/products/new/schema.ts`（新規）
  - `src/app/(features)/products/new/actions.ts`（新規）
  - `src/app/(features)/products/new/ProductCreateForm.tsx`（新規）
- 作業内容:
  - `schema.ts`: `createProductSchema` = `productBaseSchema.extend({ code: productCodeSchema, category: productCategorySchema })`
  - `actions.ts`: `createProduct` Server Action（`verifyAdmin()` → `parseWithZod` → `createProductCommandFactory().execute()` → `handleCommandError()` → `revalidatePath` → `redirect`）
  - `ProductCreateForm.tsx`: `useServerForm` + Conform フォーム。フィールド: コード、商品名、商品区分（select）、単位（select）、原価、商品説明（textarea）、備考（textarea）
  - `page.tsx`: Server Component レイアウト。「← 商品一覧に戻る」リンク、見出し「新規商品登録」、フォーム、キャンセルリンク
- コミットメッセージ: feat(product): add product create page

### Step 4: 商品詳細画面（読み取り専用表示 + 基本アクション）
- 対象ファイル:
  - `src/app/(features)/products/[productCd]/page.tsx`（新規）
  - `src/app/(features)/products/[productCd]/actions.ts`（新規）
  - `src/app/(features)/products/[productCd]/ProductDeleteForm.tsx`（新規）
  - `src/app/(features)/products/[productCd]/ProductStatusForms.tsx`（新規）
- 作業内容:
  - `page.tsx`: Server Component。`getProductByCodeQueryFactory()` で商品取得 → `notFound()` ハンドリング。読み取り専用カードレイアウトで基本情報表示（コード、商品名、区分バッジ、単位、状態バッジ、原価、説明、備考）。商品区分に応じた条件表示:
    - INDIVIDUAL → 周辺商品一覧テーブル + 「周辺商品設定」リンク
    - SET → セット構成一覧テーブル + 「セット構成設定」リンク
  - 管理者用アクションボタン: 「編集」リンク、有効化/無効化ボタン、削除ボタン
  - `actions.ts`: `deleteProduct`、`activateProduct`、`deactivateProduct` Server Actions（各 `verifyAdmin()` + Command 実行 + エラーハンドリング + redirect）
  - `ProductDeleteForm.tsx`: `useActionState` + hidden input パターン（`EmployeeDeleteForm` 踏襲）
  - `ProductStatusForms.tsx`: 有効化/無効化の簡易フォーム（hidden input + submit ボタン）
- コミットメッセージ: feat(product): add product detail page with delete and status actions

### Step 5: 商品編集画面
- 対象ファイル:
  - `src/app/(features)/products/[productCd]/edit/page.tsx`（新規）
  - `src/app/(features)/products/[productCd]/edit/schema.ts`（新規）
  - `src/app/(features)/products/[productCd]/edit/actions.ts`（新規）
  - `src/app/(features)/products/[productCd]/edit/ProductEditForm.tsx`（新規）
- 作業内容:
  - `schema.ts`: `updateProductSchema` = `productBaseSchema.extend({ code: productCodeSchema, category: productCategorySchema })`（category はフォームに含めるが disabled 表示。B011: 区分変更不可をサーバー側でも検証）
  - `actions.ts`: `updateProduct(productCd: string, prevState, formData)` Server Action（`.bind(null, productCd)` パターン）。`verifyAdmin()` → バリデーション → コードから ID 解決 → `updateProductCommandFactory().execute()` → コード変更時は新コードへ redirect
  - `ProductEditForm.tsx`: `useServerForm` + defaultValue。商品区分は disabled select で表示のみ。コード・商品名・単位・原価・説明・備考は編集可能
  - `page.tsx`: `verifySession()` → `isAdmin` チェック（非管理者は詳細へリダイレクト）→ 商品取得 → フォーム表示
- コミットメッセージ: feat(product): add product edit page

### Step 6: 周辺商品設定ページ
- 対象ファイル:
  - `src/app/(features)/products/[productCd]/relations/page.tsx`（新規）
  - `src/app/(features)/products/[productCd]/relations/actions.ts`（新規）
  - `src/app/(features)/products/[productCd]/relations/ProductRelationsForm.tsx`（新規）
- 作業内容:
  - `page.tsx`: `verifySession()` → `isAdmin` チェック → 商品取得 → category が INDIVIDUAL でなければ詳細へリダイレクト → 既存周辺商品を props として渡す
  - `actions.ts`: `setProductRelations(productCd: string, prevState, formData)` Server Action。商品コードから ID を解決し、`setProductRelationsCommandFactory().execute()` 呼び出し。制約違反（B003, B005）は `handleCommandError()` で処理
  - `ProductRelationsForm.tsx`: Client Component。動的リストフォーム:
    - 既存の周辺商品をテーブル表示（コード、商品名、区分、数量、削除ボタン）
    - 商品コード入力 + 数量入力 + 「追加」ボタン で行追加
    - 制約チェック（セット商品不可、自分自身不可、重複不可）はフロントでも表示
    - 「保存」ボタンで一括送信
- コミットメッセージ: feat(product): add related products settings page

### Step 7: セット構成設定ページ
- 対象ファイル:
  - `src/app/(features)/products/[productCd]/components/page.tsx`（新規）
  - `src/app/(features)/products/[productCd]/components/actions.ts`（新規）
  - `src/app/(features)/products/[productCd]/components/ProductComponentsForm.tsx`（新規）
- 作業内容:
  - Step 6 と同構造。category が SET の場合のみアクセス可能
  - `setProductComponents(productCd: string, prevState, formData)` Server Action → `setProductComponentsCommandFactory().execute()`
  - 制約チェック: セット商品は構成商品として選択不可、重複不可
- コミットメッセージ: feat(product): add set components settings page

### Step 8: 無効化入替ダイアログ
- 対象ファイル:
  - `src/app/_components/shadcnui/dialog.tsx`（新規 — shadcn CLI で生成）
  - `src/app/(features)/products/[productCd]/DeactivateWithReplacementDialog.tsx`（新規）
  - `src/app/(features)/products/[productCd]/actions.ts`（更新）
  - `src/app/(features)/products/[productCd]/page.tsx`（更新）
- 作業内容:
  - `pnpm dlx shadcn@latest add dialog` で shadcn Dialog コンポーネント追加（`@radix-ui/react-dialog` 依存）
  - `actions.ts` に `deactivateWithReplacement(productCd: string, prevState: ActionResult, formData: FormData)` Server Action 追加。`verifyAdmin()` → replacementCode 取得 → ID 解決 → `deactivateProductWithReplacementCommandFactory().execute()` → `handleCommandError()`（B013/B014/B015）→ redirect
  - `DeactivateWithReplacementDialog.tsx`: Client Component。Dialog 内に:
    - 参照元一覧の表示（props 経由で受け取った `referencingProducts`）
    - 入れ替え先商品コード入力欄
    - 「入れ替えて無効化」ボタン（deactivateWithReplacement Action 呼び出し）
    - 「入れ替えずに無効化」ボタン（deactivateProduct Action 呼び出し）
    - エラー表示
  - `page.tsx` 更新: 無効化ボタンの代わりに、参照がある場合は入替ダイアログを表示。`getProductReferencesQueryFactory()` で参照チェックし、結果に応じて表示を切り替え
- コミットメッセージ: feat(product): add deactivation with replacement dialog

### Step 9: レイアウト・リファクタ・ポリッシュ
- 対象ファイル:
  - `src/app/(features)/products/layout.tsx`（新規）
  - `src/app/(features)/products/_components/columns.tsx`（更新）
  - 各画面の細かな調整
- 作業内容:
  - `layout.tsx`: metadata `{ title: "商品管理" }` 設定（既存パターン踏襲）
  - `columns.tsx`: `CATEGORY_LABELS` を `_shared/labels.ts` からインポートするようリファクタ
  - 全画面で一貫したスタイリング確認（Tailwind クラス、日本語ラベル、disabled 状態、エラー表示）
  - `revalidatePath` の漏れ確認
  - `pnpm build` + `pnpm lint` 通過確認
- コミットメッセージ: feat(product): add layout and polish product pages

### Step 10: E2E テスト
- 対象ファイル:
  - `src/app/(features)/products/products-crud.e2e.ts`（新規）
  - `prisma/seed-e2e.ts`（必要に応じてリレーション seed 追加）
- 作業内容:
  - `test.describe.serial("商品CRUD - 個別商品")`: 作成（PRD901）→ 詳細確認 → 編集 → 周辺商品設定 → 無効化 → 有効化 → 削除
  - `test.describe.serial("商品CRUD - セット商品")`: 作成（PRD902）→ セット構成設定 → 削除
  - `test.describe("商品バリデーション")`: コード重複、名称重複、404 ページ
  - `test.describe("商品（一般ユーザー）")`: `storageState: "playwright/.auth/user.json"`、作成・編集不可の確認
  - 無効化入替ダイアログのテスト（参照チェック → 入替実行）
- コミットメッセージ: test(product): add E2E tests for product CRUD operations
