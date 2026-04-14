# Issue #240: 納品先の一覧・詳細（読み取り専用）画面の実装 — 実装計画

## 概要

納品先（DeliveryLocation）の一覧画面と詳細画面（読み取り専用）を実装する。
一覧に得意先名を表示するため、バックエンド側で DeliveryLocationDTO への `customerName` / `customerCode` フィールド追加と、PrismaDeliveryLocationQueryService での Customer→Company JOIN が必要。
フロントエンドは Issue #238 で実装済みの得意先ページパターンを踏襲する。

## 設計判断

### customerName/customerCode の取得方式
- 既存パターン踏襲（クエリサービス層で JOIN + DTO フラット化）のため判断不要
- 根拠: PrismaDeliveryLocationQueryService は既に Company フィールドをフラット化して DTO に詰めるパターンを採用しており、同じ方式で customer.company の name/code を追加する

## ステップ

### Step 1: DeliveryLocationDTO に customerName, customerCode を追加
- 対象ファイル:
  - `src/server/subdomains/delivery-location/application/queries/dto/DeliveryLocationDTO.ts`
- 作業内容:
  - `customerName: string` フィールドを追加
  - `customerCode: string` フィールドを追加
- コミットメッセージ: `feat: DeliveryLocationDTOにcustomerName, customerCodeフィールドを追加`

### Step 2: PrismaDeliveryLocationQueryService の修正（JOIN + マッピング）
- 対象ファイル:
  - `src/server/subdomains/delivery-location/infrastructure/queries/PrismaDeliveryLocationQueryService.ts`
- 作業内容:
  - `getSelectFields()` に `customer: { select: { company: { select: { name, code } } } }` を追加
  - `toDTO()` の入力型に `customer: { company: { name: string; code: string } }` を追加
  - `toDTO()` のマッピングに `customerName: dl.customer.company.name`, `customerCode: dl.customer.company.code` を追加
- コミットメッセージ: `feat: PrismaDeliveryLocationQueryServiceにCustomer JOINとマッピングを追加`
- 備考: Prisma のリレーション `DeliveryLocation.customer → Customer.company → Company` を辿る

### Step 3: GetDeliveryLocationByCodeQuery + ファクトリ関数の追加
- 対象ファイル:
  - `src/server/subdomains/delivery-location/application/queries/GetDeliveryLocationByCodeQuery.ts`（新規）
  - `src/server/subdomains/delivery-location/application/factories/deliveryLocationQueryFactory.ts`
  - `src/server/subdomains/delivery-location/application/factories/index.ts`
- 作業内容:
  - `GetDeliveryLocationByCodeQuery` クラスを作成（`GetProductByCodeQuery` パターン踏襲）
  - `getDeliveryLocationByCodeQueryFactory()` をファクトリに追加
  - `index.ts` にエクスポート追加
- 参照パターン: `src/server/subdomains/product/application/queries/GetProductByCodeQuery.ts`
- コミットメッセージ: `feat: GetDeliveryLocationByCodeQueryとファクトリ関数を追加`

### Step 4: 納品先一覧のテーブルカラム定義
- 対象ファイル:
  - `src/app/(features)/delivery-locations/_components/columns.tsx`（新規）
- 作業内容:
  - `ColumnDef<DeliveryLocationDTO>[]` を定義
  - カラム: code（詳細リンク）、name、customerName（得意先詳細リンク）、prefecture、phoneNumber、contactPerson、isActive（Badge）
  - null 値は `-` フォールバック
- 参照パターン: `src/app/(features)/customers/_components/columns.tsx`
- コミットメッセージ: `feat: 納品先一覧のテーブルカラム定義を追加`

### Step 5: 納品先一覧ページ
- 対象ファイル:
  - `src/app/(features)/delivery-locations/page.tsx`（新規）
- 作業内容:
  - Server Component で実装
  - 検索フィールド定義: name（text/部分一致）、code（text/完全一致）、customerId（select/動的）、isActive（select/静的）
  - 得意先セレクトの選択肢: `searchCustomersQueryFactory()` で有効な得意先を取得し `{ value: id, label: name }` にマッピング
  - `searchDeliveryLocationsQueryFactory()` でデータ取得（orderBy: code 昇順）
  - `DataTable` + `columns` でテーブル描画
- 参照パターン:
  - `src/app/(features)/customers/page.tsx`（一覧ページ構造）
  - `src/app/(features)/employees/page.tsx`（動的セレクト生成パターン）
- コミットメッセージ: `feat: 納品先一覧ページを実装`

### Step 6: 納品先詳細ページ
- 対象ファイル:
  - `src/app/(features)/delivery-locations/[code]/page.tsx`（新規）
- 作業内容:
  - `getDeliveryLocationByCodeQueryFactory()` でデータ取得
  - 存在しない場合は `notFound()` を返す
  - ブロック1（取引先基本情報）: dl/dt/dd + `md:grid-cols-2` グリッド
    - コード、名前、郵便番号（XXX-XXXX形式）、都道府県、住所、電話番号、FAX番号、担当者、状態（Badge）
  - ブロック2（納品先固有情報）:
    - 親得意先: 得意先名を `/customers/[code]` へのリンクで表示
    - 配送時注意事項: `whitespace-pre-wrap` で表示、未設定なら「なし」
  - 一覧への戻るボタン
- 参照パターン: `src/app/(features)/products/[productCd]/page.tsx`（2ブロック構成）
- コミットメッセージ: `feat: 納品先詳細ページを実装`

### Step 7: ダッシュボードにナビゲーション追加
- 対象ファイル:
  - `src/app/(features)/dashboard/page.tsx`
- 作業内容:
  - `navigationItems` 配列に納品先管理を追加: `{ href: "/delivery-locations", title: "納品先管理", description: "納品先の一覧表示を行います。" }`
  - 配置: 得意先管理の後
- コミットメッセージ: `feat: ダッシュボードに納品先管理のナビゲーションを追加`

## 検証方法

1. `pnpm lint` でリントエラーがないことを確認
2. `pnpm test` でテスト通過を確認
3. `pnpm dev` で開発サーバーを起動し、以下を確認:
   - `/delivery-locations` で一覧が表示される
   - 名前・コード・得意先・状態での検索/フィルタが動作する
   - 一覧に得意先名が表示される
   - コードクリックで詳細画面に遷移する
   - 詳細画面で基本情報ブロックが正しく表示される
   - 詳細画面で納品先固有情報ブロック（親得意先リンク + 配送時注意事項）が表示される
   - ダッシュボードに「納品先管理」カードが表示される
