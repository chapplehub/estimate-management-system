# Issue #238: 得意先の一覧・詳細（読み取り専用）画面の実装 — 実装計画

## 概要

得意先（Customer）の一覧画面と詳細画面（読み取り専用）を実装する。
既存の employees/products 画面パターンを踏襲し、SearchForm + DataTable による検索付き一覧と、
基本情報 + 得意先固有情報の2ブロック構成の詳細画面を作る。

**Issue仕様からの追加要望:**
- 検索条件に郵便番号（完全一致）、都道府県（完全一致）、住所（部分一致）、電話番号（完全一致）、FAX番号（完全一致）、担当者（部分一致）を追加
- 追加した検索条件の項目はテーブルカラムにも表示
- テーブルカラム順: コード → 名前 → 郵便番号 → 都道府県 → 住所 → 電話番号 → FAX番号 → 担当者 → マージン率 → 状態
- DataTableに横スクロールバーを追加（カラム数増加に対応）

## 設計判断

### 郵便番号検索のハイフン除去位置
- A. フロントエンド（page.tsx）で除去してからcriteriaに渡す
- B. インフラ層（PrismaCustomerQueryService.buildWhereClause）で除去する
- 推奨: B（検索前処理はクエリサービスの責務。フロントエンドは入力値をそのまま渡すだけにする）

### 都道府県セレクトボックスの選択肢ソース
- A. Prefecture.ts から `PREFECTURES` 定数をエクスポートしてフロントエンドで利用
- B. page.tsx で47都道府県リストを別途定義
- 推奨: A（single source of truth。既存パターンで `USER_ROLES` を `@server/shared/auth/types` からフロントエンドにインポートしている前例あり）

## ステップ

### Step 1: バックエンド — 検索条件の拡張
- 対象ファイル:
  - `src/server/subdomains/customer/application/queries/dto/CustomerSearchCriteria.ts`
  - `src/server/subdomains/customer/infrastructure/queries/PrismaCustomerQueryService.ts`
- 作業内容:
  - `CustomerSearchCriteria` に6フィールド追加: `postalCode`, `prefecture`, `address`, `phoneNumber`, `faxNumber`, `contactPerson`
  - `PrismaCustomerQueryService.buildWhereClause` を更新:
    - `postalCode`: ハイフン除去後 `companyWhere.postalCode = normalized` （完全一致）
    - `prefecture`: `companyWhere.prefecture = criteria.prefecture` （完全一致）
    - `address`: `companyWhere.address = { contains, mode: "insensitive" }` （部分一致）
    - `phoneNumber`: `companyWhere.phoneNumber = criteria.phoneNumber` （完全一致）
    - `faxNumber`: `companyWhere.faxNumber = criteria.faxNumber` （完全一致）
    - `contactPerson`: `companyWhere.contactPerson = { contains, mode: "insensitive" }` （部分一致）
- コミットメッセージ: feat: 得意先検索条件の拡張（郵便番号・都道府県・住所・電話番号・FAX番号・担当者）

### Step 2: バックエンド — GetCustomerByCodeQuery の追加
- 対象ファイル:
  - `src/server/subdomains/customer/application/queries/GetCustomerByCodeQuery.ts`（新規）
  - `src/server/subdomains/customer/application/factories/customerQueryFactory.ts`
  - `src/server/subdomains/customer/application/factories/index.ts`
- 作業内容:
  - `GetProductByCodeQuery` と同パターンで `GetCustomerByCodeQuery` クラスを作成
  - `customerQueryFactory.ts` に `getCustomerByCodeQueryFactory()` を追加
  - `factories/index.ts` にエクスポート追加
- コミットメッセージ: feat: GetCustomerByCodeQuery の追加

### Step 3: 共通コンポーネント — DataTable 横スクロール対応
- 対象ファイル:
  - `src/app/_components/shared/DataTable.tsx`
- 作業内容:
  - テーブルコンテナに `overflow-x-auto` を追加して横スクロールを有効化
  - 既存の `overflow-y-auto` と併用（`overflow-auto` に統合、または個別指定）
- コミットメッセージ: feat: DataTable に横スクロール対応を追加

### Step 4: フロントエンド — 都道府県リストのエクスポート
- 対象ファイル:
  - `src/server/shared/domain/values/Prefecture.ts`
- 作業内容:
  - `PREFECTURES` 定数を `export` する（既存の `PrefectureName` 型は既にexport済み）
  - フロントエンドの都道府県セレクトボックスで利用可能にする
- コミットメッセージ: refactor: PREFECTURES 定数をエクスポート

### Step 5: フロントエンド — 得意先テーブルカラム定義
- 対象ファイル:
  - `src/app/(features)/customers/_components/columns.tsx`（新規）
- 作業内容:
  - `employees/_components/columns.tsx` パターンに従い `ColumnDef<CustomerDTO>[]` を定義
  - カラム順: code（リンク付き） → name → postalCode（XXX-XXXX形式） → prefecture → address → phoneNumber → faxNumber → contactPerson → marginRate（X.XX%/-） → isActive（Badge）
- コミットメッセージ: feat: 得意先テーブルカラム定義の追加

### Step 6: フロントエンド — 得意先一覧ページ
- 対象ファイル:
  - `src/app/(features)/customers/page.tsx`（新規）
- 作業内容:
  - `employees/page.tsx` パターンに従い Server Component で実装
  - 検索フィールド定義（9フィールド）:
    - name（text, 部分一致）, code（text, 完全一致）, postalCode（text, 完全一致）
    - prefecture（select, 47都道府県 + すべて）
    - address（text, 部分一致）, phoneNumber（text, 完全一致）, faxNumber（text, 完全一致）
    - contactPerson（text, 部分一致）, isActive（select, 有効/無効）
  - `searchCustomersQueryFactory()` で検索実行
  - `SearchForm` + `DataTable` + `columns` の組み合わせ
- コミットメッセージ: feat: 得意先一覧ページの実装

### Step 7: フロントエンド — 得意先詳細ページ
- 対象ファイル:
  - `src/app/(features)/customers/[code]/page.tsx`（新規）
- 作業内容:
  - `products/[productCd]/page.tsx` パターンに従い Server Component で実装
  - `getCustomerByCodeQueryFactory()` で得意先取得、notFound() 対応
  - ブロック1: 取引先基本情報（dl/dt/dd, grid, md:grid-cols-2）
    - コード、名前、郵便番号（XXX-XXXX形式）、都道府県、住所、電話番号、FAX番号、担当者、状態（Badge）
  - ブロック2: 得意先固有情報
    - マージン率（X.XX% / 未設定）
    - 配下納品先一覧テーブル（`searchDeliveryLocationsQueryFactory()` で `{ customerId }` フィルタ）
    - 各行の code は `/delivery-locations/[code]` リンク
    - 空メッセージ: 「納品先が登録されていません」
  - 読み取り専用（編集・削除ボタンなし）
- コミットメッセージ: feat: 得意先詳細ページの実装

### Step 8: フロントエンド — ダッシュボードナビゲーション追加
- 対象ファイル:
  - `src/app/(features)/dashboard/page.tsx`
- 作業内容:
  - `navigationItems` に得意先管理を追加: `{ href: "/customers", title: "得意先管理", description: "得意先の一覧表示を行います。" }`
- コミットメッセージ: feat: ダッシュボードに得意先管理のナビゲーション追加

## 検証方法

1. `pnpm lint` でエラーがないこと
2. `pnpm dev` で開発サーバーを起動し、ブラウザで以下を確認:
   - `/customers` で得意先一覧が表示される
   - 全検索条件（名前・コード・郵便番号・都道府県・住所・電話番号・FAX番号・担当者・状態）が動作する
   - テーブルの横スクロールが機能する
   - 一覧のコードリンクから詳細画面に遷移する
   - 詳細画面の基本情報・固有情報が正しく表示される
   - ダッシュボードに「得意先管理」が表示される
