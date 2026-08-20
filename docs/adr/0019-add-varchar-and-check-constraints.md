# ADR-0019: Stringカラムに@db.VarChar(N)、数値カラムにCHECK制約を追加する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-15 |
| 最終更新日 | 2026-04-15 |

## コンテキスト

schema.prismaのStringカラムはデフォルトでPostgreSQLのTEXT型にマッピングされ、DB側に長さ制約がない。数値カラム（quantity, marginRate, costPrice）にも範囲制約がない。現状はドメイン層の値オブジェクト（StringValueObjectのMIN_LENGTH/MAX_LENGTH等）でのみバリデーションしており、直接SQLでの書き込みやアプリ層のバグによる不正データの混入をDBレベルで防げない。

## 検討した選択肢

### A. VarChar(N) + CHECK制約を追加する（採用）

値オブジェクトのMAX_LENGTHを基にStringカラムに`@db.VarChar(N)`を設定し、数値カラムにはマイグレーションSQLへの手動追記でCHECK制約を追加する。

### B. アプリケーション層のバリデーションのみで運用する（不採用）

現状維持。値オブジェクトの制約に依存し、DB側には制約を設けない。

### C. @db.Textのカラムはそのまま残す（不採用）

description, note, deliveryNotesの3カラムは`@db.Text`のまま維持し、VarChar変更の対象外とする。

## 決定

全ドメインテーブルのStringカラム（22カラム）に`@db.VarChar(N)`を追加し、数値カラム（4カラム）にCHECK制約を追加する。better-auth管理テーブル（User, Session, Account, Verification）は対象外とする。`@db.Text`の3カラムもVarChar(N)に変更する。

## 根拠

**選択肢Aを採用した理由:**
- 値オブジェクトの制約をDB層にも反映することで防御が二重化される
- PostgreSQLではTEXTとVARCHAR(N)のストレージ性能差はなく、VarChar(N)は純粋な入力チェックとして機能する
- CHECK制約はPrisma schema.prismaでは直接記述できないが、マイグレーションSQLへの手動追記で管理でき、`prisma migrate deploy`で他環境にも適用される

**選択肢Bを不採用とした理由:**
- アプリ層のバリデーションをすり抜けるケース（直接SQL、マイグレーションスクリプト等）に対して無防備

**選択肢Cを不採用とした理由:**
- 対象カラムにも値オブジェクトのMAX_LENGTHが定義されており、制約の一貫性を優先

**better-authテーブルを対象外とした理由:**
- ライブラリが内部的にデータを書き込むため、制約追加がライブラリの動作を壊すリスクがある

## 影響

- Mapper、Repository、Zodスキーマ等のアプリケーション層コードに変更は不要（PrismaのTypeScript型はstringのまま変化しない）
- 今後新規テーブル・カラム追加時は、値オブジェクトのMAX_LENGTHに合わせて`@db.VarChar(N)`を設定する運用が必要
- CHECK制約はschema.prismaに表現できないため、数値制約の追加・変更時はマイグレーションSQLの手動編集が必要
