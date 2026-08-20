# ADR-0009: ID生成方式をCUID2からUUIDv7に移行する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-04 |
| 最終更新日 | 2026-04-04 |

## コンテキスト

現在、全ドメインエンティティのID生成に `@paralleldrive/cuid2` を使用している。
CUID2 は衝突耐性に優れるが、以下の課題がある：

- CUID2 はセキュリティのためタイムスタンプベースのソートを意図的に排除しており、生成順でのソートが不可能
- CUID は独自フォーマット（25文字）であり、PostgreSQL のネイティブ UUID 型と互換性がない
- 各エンティティが `createId()` を直接importしており、ID生成戦略の変更が困難

移行にあたり、以下の3点を判断する必要がある：

1. Prisma カラム型を `String` のまま維持するか、PostgreSQL ネイティブ UUID 型に変更するか
2. better-auth 管理テーブル（User/Session/Account/Verification）のID生成もUUIDv7に統一するか
3. 型付き ID Value Object（EmployeeId 等）を同時に導入するか

## 検討した選択肢

### 判断1: Prisma カラム型

#### A. `String @id` を維持（採用）

値のフォーマットのみ UUIDv7 に変更し、カラム型は変えない。

#### B. PostgreSQL ネイティブ UUID 型に変更（不採用 → #188 で別途検討）

`@db.Uuid` を指定し、16byte 固定長の UUID 型カラムに変更。B-tree インデックスの最適化が期待できる。

### 判断2: better-auth テーブルのID生成

#### A. ドメインテーブルのみ UUIDv7 に変更（不採用）

auth テーブルは better-auth のデフォルト（ランダム文字列）のまま維持。

#### B. `advanced.database.generateId` コールバックで全テーブル統一（採用）

better-auth の設定で `generateId` コールバックを指定し、auth テーブルも UUIDv7 で統一する。

### 判断3: ID Value Object の導入タイミング

#### A. 今回のスコープで導入（不採用 → #189 で別途対応）

UUIDv7 移行と同時に `EntityId extends StringValueObject` を全エンティティ・リポジトリ・マッパーに導入。

#### B. 別 Issue に分離（採用）

今回は ID 生成方式の変更のみに集中し、Value Object 導入は後続で対応。

## 決定

ID生成を `@paralleldrive/cuid2` から `uuid` パッケージの UUIDv7 (`v7()`) に移行する。
共有ユーティリティ `generateId()` に集約し、ドメインエンティティと better-auth テーブルの両方で使用する。
Prisma カラム型は `String @id` を維持する。

## 根拠

**カラム型を String 維持とした理由:**
- better-auth の User テーブルが `employeeId String?` で Employee.id を参照しており、ドメイン側だけカラム型を変更すると FK の型不一致が発生する
- カラム型変更は全テーブル同時のマイグレーションが必要で、ID生成方式の変更とは独立した作業になる
- UUIDv7 文字列でも辞書順ソート = 時間順ソートは成立するため、ソート課題は解決される

**auth テーブルも UUIDv7 に統一した理由:**
- プロジェクト全体で ID フォーマットが一貫し、運用・デバッグ時の混乱を防ぐ
- better-auth の `advanced.database.generateId` コールバックで容易に実現可能
- 将来ネイティブ UUID 型に移行する際、全テーブルが同一フォーマットであれば一括対応できる

**Value Object を別 Issue に分離した理由:**
- ID フォーマット変更（28ファイル）と型付け導入（60+ファイル）はスコープが異なる
- 段階的に移行することでレビュー・テストの負荷を分散できる

## 影響

- UUIDv7 は36文字（ハイフン含む）で CUID2 の25文字より長い。URL パラメータや API ペイロードが微増する
- `String` カラムのため、PostgreSQL ネイティブ UUID のインデックス最適化（16byte 固定長）は得られない。これは #188 で対応可能
- ID に型安全性はまだない（`string` のまま）。EmployeeId と CustomerId の取り違えはコンパイル時に検出できない。これは #189 で対応予定
