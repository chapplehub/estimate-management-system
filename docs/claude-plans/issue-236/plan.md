# 汎用選択モーダルによる周辺商品追加機能の実装 — 実装計画

## コンテキスト

`ProductRelationsForm` で新規に周辺商品を追加すると、商品名・区分が「—」と表示される。
原因: クライアントコンポーネントの `handleAdd` で `{ code, name: "", category: "" }` として追加しているため。

この問題を解決するとともに、商品・従業員など複数の一覧で再利用可能な
**汎用選択モーダル**を導入する。

### 動作フロー
1. 周辺商品設定画面で「商品を追加」ボタンをクリック
2. フルスクリーンモーダルで商品一覧（検索フォーム + テーブル）が開く
3. 検索ボタンを押してデータ取得、ページ送りしながらチェックボックスで商品を選択
4. 「N件を追加」ボタンで選択商品データを親に返しモーダルを閉じる
5. 周辺商品テーブルに選択商品が追加される（name, category 付き）
6. 各商品の数量を設定して「保存」

### 除外条件
- 自分自身（現在の商品コード）
- 既に追加済みの商品
- 非アクティブ商品（`isActive: false`）

## 設計判断

### モーダル内の検索フォーム
- A. 既存 `SearchForm` を改修して URL / callback 両モード対応にする
- B. モーダル専用の `ModalSearchForm` を新規作成（`SearchFieldDef` 型は共有）
- 推奨: B（既存 SearchForm は URL ベースに特化しており、責務を分離した方がシンプル）

### SelectionModal のデータ管理
- A. 親コンポーネントが data state と search を管理し、モーダルには表示のみ任せる
- B. SelectionModal が内部で data / loading / selection state を一括管理し、`searchAction` を受け取る
- 推奨: B（モーダルが自己完結し、各利用側のコードが最小限になる）

### 除外商品のフィルタリング
- A. Server Action 側で除外（DB クエリに NOT IN 条件）
- B. クライアント側で検索結果から除外
- 推奨: B（除外リストは親コンポーネントの state に依存するため、クライアント側が自然）

## ステップ

### Step 1: DataTable に行選択機能を追加（後方互換）
- 対象ファイル: `src/app/_components/shared/DataTable.tsx`
- 作業内容:
  - Props に追加: `enableRowSelection?`, `rowSelection?`, `onRowSelectionChange?`, `getRowId?`
  - `enableRowSelection` が true の場合、先頭にチェックボックスカラムを自動挿入
  - `useReactTable` に `enableRowSelection`, `state.rowSelection`, `onRowSelectionChange`, `getRowId` を渡す
  - ヘッダーのチェックボックスで全選択/全解除
  - 既存の利用箇所（商品・従業員・部署・役職一覧）には影響なし
- コミットメッセージ: `feat(shared): DataTableに行選択機能を追加`

### Step 2: ModalSearchForm コンポーネントの作成
- 対象ファイル: `src/app/_components/shared/ModalSearchForm.tsx`（新規）
- 作業内容:
  - 既存 `SearchForm` と同じ `SearchFieldDef` 型を利用
  - Props: `fields`, `onSearch: (values: Record<string, string>) => void`, `isLoading?`
  - 検索ボタンで `onSearch(values)` を呼ぶ（URL 操作しない）
  - クリアボタンでフィールドをリセットし `onSearch({})` は呼ばない（検索しない）
  - UI は既存 SearchForm と統一感のあるスタイル
- コミットメッセージ: `feat(shared): モーダル用検索フォームコンポーネントの作成`

### Step 3: SelectionModal 汎用コンポーネントの作成
- 対象ファイル: `src/app/_components/shared/SelectionModal.tsx`（新規）
- 作業内容:
  - ジェネリック型 `<TData>` で任意のデータ型に対応
  - Props:
    ```
    isOpen, onClose, title
    searchFields: SearchFieldDef[]
    searchAction: (criteria: Record<string, string>) => Promise<TData[]>
    columns: ColumnDef<TData>[]
    onConfirm: (selectedItems: TData[]) => void
    getRowId: (row: TData) => string
    emptyMessage: string
    excludeIds?: string[]
    ```
  - 内部 state: `data`, `isLoading`, `rowSelection`
  - 検索フォーム送信 → `searchAction` 呼び出し → 結果から `excludeIds` をフィルタ → DataTable に表示
  - 新しい検索実行時に `rowSelection` をリセット（検索またぎ選択は不要のため）
  - ページまたぎの選択は維持（TanStack Table の `getRowId` + 外部管理 `rowSelection` で実現）
  - フルスクリーンダイアログ: `fixed inset-0 z-50` のオーバーレイ
  - フッター: 「キャンセル」「{N}件を追加」ボタン（選択0件時は追加ボタン disabled）
  - モーダルを開いた時点ではデータ未取得（検索ボタンを押して初めて取得）
- コミットメッセージ: `feat(shared): 汎用選択モーダルコンポーネントの作成`

### Step 4: 商品選択用 Server Action とカラム定義の作成
- 対象ファイル:
  - `src/app/(features)/products/_shared/actions.ts`（新規）
  - `src/app/(features)/products/_shared/selectionColumns.tsx`（新規）
- 作業内容:
  - **Server Action**: `searchProductsForSelection(criteria: Record<string, string>): Promise<ProductRow[]>`
    - `searchProductsQueryFactory` を使用
    - `criteria` の各キー（code, name, category, isActive）を `ProductSearchCriteria` にマッピング
    - `isActive: true` を強制（非アクティブ商品を除外）
    - `limit: LIST_FETCH_LIMIT`, `orderBy: { field: "code", direction: "asc" }`
    - 認証: `verifySession`
  - **カラム定義**: 既存の `columns.tsx` から Link を除いたシンプル版
    - 商品コード（テキスト表示、リンクなし）、商品名、商品区分（Badge）
    - `ProductRow` 型は既存の `columns.tsx` から re-export
- コミットメッセージ: `feat(products): 商品選択用Server Actionとカラム定義の作成`

### Step 5: ProductRelationsForm への統合
- 対象ファイル:
  - `src/app/(features)/products/[productCd]/relations/page.tsx`（変更）
  - `src/app/(features)/products/[productCd]/relations/ProductRelationsForm.tsx`（変更）
- 作業内容:
  - **page.tsx**: `ProductRelationsForm` に `productId={product.id}` を追加で渡す
  - **ProductRelationsForm**:
    - Props に `productId: string` を追加
    - `newCode`, `newQuantity` state を削除、`isModalOpen` state を追加
    - 商品コード入力欄 + 数量入力 + 追加ボタン → 「商品を追加」ボタンに置き換え
    - `SelectionModal` を配置:
      - `searchFields`: 商品一覧と同じ検索フィールド定義（code, name, category）
      - `searchAction`: Step 4 の Server Action
      - `columns`: Step 4 の選択用カラム
      - `excludeIds`: `[productId, ...initialRelations の relatedProductId]`
      - `onConfirm`: 選択された商品を `relations` state に追加（name, category 付き）
    - `handleAdd` を `handleConfirmSelection(selectedProducts)` に置き換え
    - 選択された各商品を `{ code, name, category, quantity: 1 }` で追加
    - 数量はテーブル内で後から編集
  - `newQuantity` state も不要になるため削除
- コミットメッセージ: `fix(products): 周辺商品追加を選択モーダル方式に変更し商品情報の表示を修正`

### Step 6: 動作確認
- 確認内容:
  - `pnpm build` が通ること
  - 既存の一覧画面（商品・従業員・部署・役職）が正常に動作すること（DataTable の後方互換）
  - 周辺商品設定画面で「商品を追加」→ モーダルが開くこと
  - モーダル内で検索 → 結果表示 → ページ送りしながら選択 → ページまたぎで選択維持
  - 自分自身・追加済み商品が候補に表示されないこと
  - 「N件を追加」で閉じて、テーブルに商品名・区分が正しく表示されること
  - 数量を変更して「保存」が正常に完了すること
  - 既存の周辺商品も引き続き正しく表示されること

## 主要ファイル

| ファイル | 操作 | 役割 |
|---|---|---|
| `src/app/_components/shared/DataTable.tsx` | 変更 | 行選択機能の追加 |
| `src/app/_components/shared/ModalSearchForm.tsx` | 新規 | モーダル用検索フォーム |
| `src/app/_components/shared/SelectionModal.tsx` | 新規 | 汎用選択モーダル |
| `src/app/(features)/products/_shared/actions.ts` | 新規 | 商品検索 Server Action |
| `src/app/(features)/products/_shared/selectionColumns.tsx` | 新規 | 商品選択用カラム定義 |
| `src/app/(features)/products/[productCd]/relations/ProductRelationsForm.tsx` | 変更 | モーダル統合 |

## 再利用する既存コード

- `SearchFieldDef` 型 — `src/app/_components/shared/SearchForm.tsx`
- `DataTable` + `ColumnDef` — `src/app/_components/shared/DataTable.tsx`
- `ProductRow` 型 — `src/app/(features)/products/_components/columns.tsx`
- `searchProductsQueryFactory` — `src/server/subdomains/product/application/factories/productQueryFactory.ts`
- `CATEGORY_LABELS` — `src/app/(features)/products/_shared/labels.ts`
- `Badge` — `src/app/_components/shadcnui/badge.tsx`
- `LIST_FETCH_LIMIT` — `src/app/_lib/searchParams.ts`

## 注意事項

- **excludeIds の受け渡し**: `page.tsx` から `productId` を追加 props として渡す。追加済み商品は `initialRelations` の `relatedProductId` を使用。`SelectionModal` の `getRowId` が返す値と `excludeIds` を照合してフィルタリング
- **ページまたぎ選択**: `getRowId` で行を一意に識別し、`rowSelection` state をテーブル外部で管理することで、ページネーション切替時も選択状態を維持
- **将来の再利用**: `ProductComponentsForm`、`DeactivateWithReplacementDialog`、従業員・部署の選択など、同じパターンを適用可能
