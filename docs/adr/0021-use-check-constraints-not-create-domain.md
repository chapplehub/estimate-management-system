# ADR-0021: 数値・文字列の制約にCREATE DOMAINを使わずCHECK制約を継続する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-05-20 |
| 最終更新日 | 2026-05-20 |

## コンテキスト

ADR-0019 で数値カラムの範囲制約を「マイグレーションSQLへの手動追記による`ALTER TABLE ... ADD CONSTRAINT ..._check`」で実装する方針を採用した。

見積スキーマ実装（Issue #272）のレビューで、生成された`CREATE TABLE`の列定義が`fiscal_year INTEGER`のように素の型しか示さず、別オブジェクトとして付与したCHECK制約の存在が列定義から読み取れない、という指摘があった。PostgreSQLの`CREATE DOMAIN`を使えば`fiscal_year fiscal_year_t`のように制約を型レベルに埋め込め、自己文書化できるのではないかという提案である。

このプロジェクトはPrismaを採用しており、`schema.prisma`をスキーマの単一の真実の源（single source of truth）としている。この前提のもとでCREATE DOMAINが採用可能かを判断する必要がある。

## 検討した選択肢

### A. CHECK制約を継続する（採用）

ADR-0019 の方針を維持し、範囲制約はマイグレーションSQLへの手動追記で別オブジェクトとして付与する。列の型は`INTEGER` / `DECIMAL` のまま。

```sql
CREATE TABLE "estimates" (
  "fiscal_year" INTEGER NOT NULL
);
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_fiscal_year_check"
  CHECK ("fiscal_year" >= 2000 AND "fiscal_year" <= 9999);
```

### B. CREATE DOMAINで型レベルに制約を埋め込む（不採用）

```sql
CREATE DOMAIN fiscal_year_t AS integer
  CHECK (VALUE >= 2000 AND VALUE <= 9999);

CREATE TABLE "estimates" (
  "fiscal_year" fiscal_year_t NOT NULL
);
```

PostgreSQL単体ではこの構文は有効で、制約が型として自己文書化される利点がある。

## 決定

CREATE DOMAINは採用せず、ADR-0019 のCHECK制約方式を継続する。

## 根拠

**PostgreSQL単体ではBが成立することは確認済み**（[公式ドキュメント](https://www.postgresql.jp/document/18/html/sql-createdomain.html)）。提案の「型レベルでの自己文書化」という利点も事実である。それでもBを不採用としたのは、Prismaとの組み合わせで以下の問題が生じるため:

- **恒常的なdrift**: `schema.prisma`のDSLにはドメイン型を表現する構文がなく、フィールドは`Int` / `Decimal`としか書けない。マイグレーションSQLを手でドメイン型に書き換えると、Prismaのshadow DB比較で「DB＝独自ドメイン型／スキーマ＝integer」と毎回driftとして検出され、`prisma migrate dev`のたびに手当てが必要になる。
- **Unsupported型化**: Prismaがドメイン列をintrospectすると`Unsupported("fiscal_year_t")`にマッピングする。`Unsupported`フィールドはPrisma Clientの型付きcreate/updateから除外されるため、`prisma.estimate.create({ data: { fiscalYear } })`が書けなくなる。
- **DDDレイヤーへの波及**: Infrastructure層のPrisma↔Domainマッピングが、Unsupported列のためにraw SQL併用を強いられ、ADR-0009/0010で整えたマッピング規約と整合しなくなる。

対して**CHECK制約方式（A）はPrismaから見て列型が素の`INTEGER` / `DECIMAL`のまま・制約は別オブジェクト**であるため、Prismaがこれを無視でき、driftを起こさない。ADR-0019 で手動追記を採用したのと同じ「DSLで表現できない制約を、ORMが無視できる形で足す」という回避策が、ドメイン型では型そのものを置換するために機能しない点が決定的である。

自己文書化の欠如は、`estimates_fiscal_year_check`のような制約名で補う。

## 影響

- ADR-0019 の運用（数値制約はマイグレーションSQL手動追記）を引き続き踏襲する。新規テーブル・カラム追加時も同方式で範囲制約を付与する。
- 列定義から制約の存在を読み取れない点はトレードオフとして受容する。制約の一覧性が必要な場合はマイグレーションSQLまたは`information_schema.check_constraints`を参照する。
- 将来Prismaを脱却しraw SQLマイグレーション運用へ移行する場合は、CREATE DOMAINが有力な選択肢として再検討に値する。本決定は「現スタック（Prisma前提）では」という条件付きである。
