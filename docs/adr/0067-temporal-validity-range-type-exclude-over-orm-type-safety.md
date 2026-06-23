# ADR-0067: 期間付きマスタの妥当期間は範囲型＋EXCLUDE で表現し、ORM 型安全より NULL レス・番兵レスを優先する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-23 |
| 最終更新日 | 2026-06-23 |

## コンテキスト

#426 の共通販売単価集約（ADR-0066）は、適用期間（→ CONTEXT.md「適用期間」）付きの行を持ち、同一商品内で適用期間が重複してはならない。この「妥当期間（temporal validity）と重複禁止」をどう物理表現するかを定める必要がある。

設計上、次の3つの性質が望ましいが、無期限（上端 unbounded）の表現方法が三者を引き裂き、**同時には2つしか満たせない**ことが判明した。

- **NULL レス**: テーブルから NULL を排除する（既存方針。kawasima デシジョンツリー）
- **番兵レス**: `9999-12-31` のような番兵マジック値を使わない
- **ORM 型安全**: Prisma の typed Client で読み書きでき、生 SQL（`$queryRaw`）を要しない

## 検討した選択肢

### A. 範囲型カラム1列 ＋ EXCLUDE USING gist（採用）

`applicable_period daterange` 1列に半開区間 `[開始, 終了)` を持ち、無期限は上端 unbounded `[開始,)` で表す。重複禁止は `EXCLUDE USING gist (product_id WITH =, applicable_period WITH &&)`（`btree_gist` 拡張）で DB が物理保証する。**NULL レス・番兵レスを両立するが、Prisma が範囲型を `Unsupported` 扱いにするため `$queryRaw` が必須**。

### B. 2列（from/to）＋ to を nullable（不採用）

`to IS NULL` で無期限を表す。Prisma typed のままだが、「unbounded を NULL で表す」ことになり NULL 排除方針に反する。

### C. 2列（from/to）＋ 番兵 NOT NULL（不採用）

無期限を `9999-12-31` で表す。Prisma typed・NULL レスだが、番兵マジック値がドメインにまで漏れうる。

## 決定

妥当期間は範囲型カラム（`daterange`）1列で表現し、重複禁止は `EXCLUDE USING gist` で DB が物理保証する（A を採用）。その代償として Prisma の型安全を一部捨て、Mapper/Repository で `$queryRaw` 手書きを受け入れる。

## 根拠

- **トリレンマで A だけが NULL レス・番兵レスを両立する**: B は NULL で、C は番兵で無期限を表すため、いずれも既存のスキーマ方針（NULL 排除・unbounded は NULL ではない）に反する。範囲型は上端 unbounded をネイティブに表現でき、両方を構造的に満たす。
- **重複禁止の置き場が明快**: `EXCLUDE USING gist (product_id WITH =, applicable_period WITH &&)` 単一制約で「商品ごとに区間重複ゼロ」を物理保証する。ADR-0066 の集約内 `overlaps` チェック（UX・早期エラー）と合わせ二重防御を構成する。並行トランザクションの競合は集約内チェックでは防げず、DB の EXCLUDE が最後の砦になる。
- **被害の局所化と償却**: `$queryRaw` の影響は範囲型を持つこのテーブル群に閉じ、読み書きパターンが単純（期間行 upsert／見積年月日での contains 取得）で動的クエリが少ない。後続フェーズ A2（得意先別・納品先別販売単価）も同じ範囲型＋EXCLUDE を再利用でき、範囲型パーサ/ジェネレータを一度書けば3レイヤーで償却できる。
- **粒度は日付**: 適用期間は暦日の業務概念であり見積年月日（date）で解決するため、`tstzrange` ではなく `daterange` を採る。日時にすると TZ 換算が境界判定に混入する。timestamptz 統一（ADR-0010）は「瞬間を記録する列」の方針であって、日付概念の業務データには及ばない。

なお、複雑性は消えるのではなく層を移動する点に注意する。A は正しさを DB の型システムに寄せる代わりに、Mapper の範囲型パース・`daterange()` 生成・`$queryRaw` でインフラ層の複雑性が増える。選定理由は「複雑性削減」ではなく「DB 物理保証＋NULL レス＋番兵レス」である。

## 影響

- マイグレーション先頭で `CREATE EXTENSION IF NOT EXISTS btree_gist;` を実行する。範囲型カラム・EXCLUDE 制約は Prisma スキーマに書けないため、CHECK 制約と同じく手書き SQL マイグレーション（ADR-0019/0021 の運用）に置く。
- `schema.prisma` では当該カラムを `Unsupported("daterange")` と宣言し、Repository/Mapper で `$queryRaw`／`$executeRaw` により読み（`[2025-07-01,)` 文字列のパース）・書き（`daterange($from,$to,'[)')` 生成）を手書きする。差分 upsert（ADR-0032）＋楽観ロック（ADR-0039）も生 SQL で組み、影響行数から `ConflictError` を判定する。
- 範囲型パーサ・`daterange` ジェネレータは infra の共有ヘルパに隔離し、Mapper 本体への生 SQL の染み出しを抑える。
- 半開区間は `[開始, 終了)`（開始日を含み終了日を含まない）。`ApplicablePeriod` VO の `contains`/`overlaps` もこの境界定義に揃える。
- 本決定は期間付きマスタ全般（共通販売単価・原価・後続の得意先別/納品先別販売単価）に適用する一般則とする。
