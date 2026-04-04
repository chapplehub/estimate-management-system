# ADR-0010: 全テーブルのDateTimeカラムをtimestamptz（タイムゾーン付き）に移行する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-04 |
| 最終更新日 | 2026-04-04 |

## コンテキスト

現在のPrismaスキーマでは全テーブルの `DateTime` カラムがデフォルトの `timestamp(3)` (without time zone) でPostgreSQLに格納されている。この型はタイムゾーン情報を持たないため、以下の課題がある：

- PostgreSQLのセッションで `SET timezone = 'Asia/Tokyo'` を設定しても、取得時に自動変換されずUTCの値がそのまま返される
- DBツール（Prisma Studio、psql等）で直接データを確認する際、常にUTC表示となり日本時間への読み替えが必要
- `timestamptz` はPostgreSQL公式ドキュメントで推奨されている型である

対象は全12テーブル・29カラム（ドメインテーブル8つ + better-authテーブル4つ）。

## 検討した選択肢

### A. `@db.Timestamptz(3)` に移行する（採用）

Prismaスキーマの全DateTimeフィールドに `@db.Timestamptz(3)` アノテーションを追加し、PostgreSQL上のカラム型を `timestamptz(3)` に変更する。

### B. `timestamp(3)` のまま維持する（不採用）

現状維持。アプリケーション層ではPrismaが `Date` オブジェクトを透過的に扱うため動作上の問題はない。

## 決定

全テーブルの `DateTime` カラムに `@db.Timestamptz(3)` を追加し、PostgreSQL上で `timestamptz(3)` 型に移行する。マイグレーション時に `SET TimeZone = 'UTC'` を実行し、既存データの意図しないタイムゾーンシフトを防止する。

## 根拠

**`timestamptz` を採用した理由:**
- PostgreSQL公式が推奨する型であり、タイムゾーンを意識した運用が可能になる
- 内部的にはUTCで保存しつつ、取得時にセッションのタイムゾーンに応じた自動変換が行われる
- Prisma Clientは `timestamp` / `timestamptz` どちらでもJavaScript `Date` オブジェクトを透過的に扱うため、アプリケーション層の変更が不要

**選択肢Bを不採用とした理由:**
- `timestamp` のままではDBツールでの直接確認時に常にUTC→JST変換の手間が発生する
- 将来マルチタイムゾーン対応が必要になった場合、`timestamptz` であれば追加変更なしで対応可能

**マイグレーション時の `SET TimeZone = 'UTC'` について:**
- 既存データはPrisma Client経由でUTC値が格納されている
- `timestamp` → `timestamptz` への `ALTER COLUMN` 時、PostgreSQLはサーバーの `TimeZone` 設定に基づいて値を解釈する
- サーバーが `Asia/Tokyo` に設定されている場合、UTC値が「JSTとして解釈→UTC変換」され9時間ずれるリスクがある
- `SET TimeZone = 'UTC'` を先に実行することで、既存データがUTCとして正しく解釈される

## 影響

- better-authの認証フロー（セッション有効期限等）への影響はない（Prismaアダプターが型差異を吸収）
- ドメイン層・アプリケーション層のコード変更は不要
- DBツール上で `SET timezone = 'Asia/Tokyo'` を設定すればJSTで表示されるようになる
- Prismaスキーマの全DateTimeフィールドに `@db.Timestamptz(3)` が付与されるため、今後新規テーブル追加時も同アノテーションを付ける運用が必要
