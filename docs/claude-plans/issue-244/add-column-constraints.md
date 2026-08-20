# DBスキーマへの桁数制約・CHECK制約の追加 — 実装計画

## 概要

schema.prisma の String カラムに `@db.VarChar(N)` が未設定のため、値オブジェクトの MAX_LENGTH を基に桁数制約を追加する。
また、数値カラムに CHECK 制約を追加し、DBレベルでの不正データ防止を強化する。

better-auth 管理テーブル（User, Session, Account, Verification）は対象外。

## 設計判断

### @db.Text → @db.VarChar(N) への変更
- 3カラム（Product.description, Product.note, DeliveryLocation.deliveryNotes）を VarChar(N) に変更する
- 理由: 今回の改修の趣旨（DBレベルでの桁数制約の一貫適用）と整合するため

### contactPerson の桁数
- 値オブジェクトが存在しないため、ユーザー判断で 100 桁に決定

## ステップ

### Step 1: schema.prisma に VarChar(N) を追加
- 対象ファイル: `prisma/schema.prisma`
- 作業内容:
  - 以下のマッピングに従い `@db.VarChar(N)` を追加する
  - `@db.Text` の3カラムは `@db.VarChar(N)` に変更する
  - better-auth テーブル（User, Session, Account, Verification）は変更しない

#### カラム-桁数マッピング

| モデル | カラム | VarChar(N) | 根拠 |
|--------|--------|-----------|------|
| Position | positionCd | 6 | PositionCd.MAX_LENGTH |
| Position | name | 50 | PositionName.MAX_LENGTH |
| Role | roleCd | 7 | RoleCd.MAX_LENGTH |
| Role | name | 100 | RoleName.MAX_LENGTH |
| Employee | employeeCd | 9 | EmployeeCd.MAX_LENGTH |
| Employee | email | 254 | MailAddress.MAX_LENGTH |
| Employee | name | 100 | EmployeeName.MAX_LENGTH |
| Department | departmentCd | 7 | DepartmentCd.MAX_LENGTH |
| Department | name | 100 | DepartmentName.MAX_LENGTH |
| Department | abbreviation | 20 | Abbreviation.MAX_LENGTH |
| Company | code | 20 | CompanyCode.MAX_LENGTH |
| Company | name | 100 | CompanyName.MAX_LENGTH |
| Company | postalCode | 7 | PostalCode.MAX_LENGTH |
| Company | prefecture | 4 | Prefecture.MAX_LENGTH |
| Company | address | 200 | Address.MAX_LENGTH |
| Company | phoneNumber | 11 | PhoneNumber.MAX_LENGTH |
| Company | faxNumber | 11 | FaxNumber.MAX_LENGTH |
| Company | contactPerson | 100 | ユーザー指定 |
| DeliveryLocation | deliveryNotes | 500 | DeliveryNotes.MAX_LENGTH（@db.Text → VarChar） |
| Product | code | 50 | ProductCode.MAX_LENGTH |
| Product | name | 100 | ProductName.MAX_LENGTH |
| Product | description | 1000 | ProductDescription.MAX_LENGTH（@db.Text → VarChar） |
| Product | note | 1000 | ProductNote.MAX_LENGTH（@db.Text → VarChar） |

- コミットメッセージ: `refactor(db): Stringカラムに@db.VarChar(N)桁数制約を追加`

### Step 2: マイグレーションSQL生成（--create-only）
- 作業内容:
  - `npx prisma migrate dev --create-only --name add_column_constraints` を実行
  - SQLファイルが `prisma/migrations/` に生成されることを確認
  - この時点ではDBに適用しない

### Step 3: CHECK制約をマイグレーションSQLに追記
- 対象ファイル: `prisma/migrations/{timestamp}_add_column_constraints/migration.sql`（Step 2 で生成）
- 作業内容:
  - 自動生成されたSQLの末尾に以下のCHECK制約を追記する

```sql
-- CHECK制約: 数値カラムの範囲制約
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_quantity_check" CHECK ("quantity" >= 1);
ALTER TABLE "set_product_components" ADD CONSTRAINT "set_product_components_quantity_check" CHECK ("quantity" >= 1);
ALTER TABLE "customers" ADD CONSTRAINT "customers_margin_rate_check" CHECK ("margin_rate" >= 0 AND "margin_rate" <= 100);
ALTER TABLE "products" ADD CONSTRAINT "products_cost_price_check" CHECK ("cost_price" >= 0);
```

- コミットメッセージ: `refactor(db): 数値カラムにCHECK制約を追加`

### Step 4: マイグレーション適用と動作確認
- 作業内容:
  - `npx prisma migrate dev` でマイグレーションを適用する
  - `pnpm db:generate` で Prisma Client を再生成する
  - `pnpm build` でビルドエラーがないことを確認する
  - `pnpm test` でテストが通ることを確認する
  - `pnpm e2e:setup && pnpm e2e` で E2E テストの動作確認

## 変更対象外の確認

以下は変更不要であることを確認済み:
- 値オブジェクト（制約のソースなので変更不要）
- Mapper クラス（Prisma型は string のまま）
- Repository クラス（型レベルで影響なし）
- Zod スキーマ（フロント側バリデーション、独立）
- Server Actions（影響なし）
- シードデータ（全データが制約内に収まることを確認済み）
