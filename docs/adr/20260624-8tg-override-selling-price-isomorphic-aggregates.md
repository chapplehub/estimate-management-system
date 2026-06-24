# ADR-20260624-8tg: 販売単価の上書き2層は複合自然キーを identity とする独立同型集約として実装する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-24 |
| 最終更新日 | 2026-06-24 |

## コンテキスト

#427 で販売単価の上書き2層（得意先別販売単価・納品先別販売単価）を集約・永続化として実装するにあたり、これらの構造をどうモデル化するかを決める必要がある。

ADR-0066 は共通販売単価を「商品単位集約（適用期間行を内包）」とし、後続フェーズで得意先別・納品先別の3層へ拡張されると予告したが、上書き層の**集約境界と code 構造そのもの**（同型な2層をどう実装するか・集約ルートの identity を何にするか）は決めていない。

上書き2層は構造が同型である（キー ＋ 売単価 ＋ 適用期間、原価は持たない・ADR-0065）。両者の違いは「キーの宛先側 ID が得意先か納品先か」と「テーブル名」だけで、それ以外（期間行・重複禁止不変条件・永続化パターン）は完全に一致する。この同型性をコードでどう扱うかが論点になった。

なお、CONTEXT.md は「得意先別販売単価」「納品先別販売単価」を別個の正準語として定義し、価格決定は提出区分で一方だけを選びクロス参照しない（→ CONTEXT.md「価格決定」）。

## 検討した選択肢

### A. 独立した具象集約2つ・葉 VO のみ共有（採用）

`CustomerSellingPrice` と `DeliveryLocationSellingPrice` を別々の具象集約として定義する。各集約は自前の期間行子エンティティ（`CustomerSellingPricePeriod` / `DeliveryLocationSellingPricePeriod`）・Repository・Mapper・テーブルを持つ。共有するのは葉の値オブジェクト（`ApplicablePeriod`・`SellingUnitPrice`）のみ。

集約ルートの identity は**複合自然キー**とする — 得意先別は `(CustomerId, ProductId)`、納品先別は `(DeliveryLocationId, ProductId)`。これは「同一キー内で適用期間が重複してはならない」という不変条件の重複禁止キーがそのまま identity になる（共通販売単価が `ProductId` を identity にしたのと同じ思想・ADR-0066）。

### B. スコープ判別子で1集約に統合（不採用）

`OverrideSellingPrice` 1集約が `customerId | deliveryLocationId` のどちらかを判別子つきで持つ。テーブルも判別子列つきの1枚に寄せる。

### C. 抽象基底クラス ＋ 薄いサブクラス（不採用）

期間行・重複判定・永続化を抽象基底に置き、2層を継承で派生させる。

## 決定

上書き2層は、複合自然キー（`(CustomerId, ProductId)` / `(DeliveryLocationId, ProductId)`）を集約ルートの identity とする独立した具象集約2つとして実装し、共有は葉 VO（`ApplicablePeriod`・`SellingUnitPrice`）に限定する（A を採用）。判別子統合（B）・継承共有（C）は採らない。

## 根拠

- **ドメイン言語に判別子という概念が無い（A vs B）**: CONTEXT.md は2層を別正準語として扱い、価格決定は提出区分で一方だけを選びクロス参照しない。判別子（B）は言語に存在しない概念をコードに持ち込み、「得意先宛が納品先別を見る」誤りを型で防げなくする。独立集約なら宛先ごとに別の型・別の ID（branded `EntityId`）になり、誤参照がコンパイルエラーになる。
- **前例が「同型でも具象を平坦化」（A vs C）**: ADR-0043 は Company のサブタイプ（得意先・納品先）を継承ではなく2つの具象テーブルへ平坦化した。本コードベースは早すぎる抽象化より明示的重複を許容する方針で、共通販売単価（ADR-0066）も具象集約として手書きされている。同型2層も同じ方針が一貫する。
- **重複の実体が小さい**: 2層で重複するのは期間行エンティティと `$queryRaw` の table 名違いだけ。これに抽象基底（C）を被せるコストは、得られる DRY に見合わない。生 SQL の本当に間違えやすい部分（半開区間 `[)`）は別途 infra 共有ヘルパに隔離して償却する（ADR-0067）。
- **複合自然キー identity が重複禁止不変条件と一致する**: 「同一キー内で期間重複ゼロ」をキーごとに1集約へロードして集約内 `overlaps` で守る構造（ADR-0066・0029）は、identity を重複禁止キーに揃えて初めて成立する。サロゲートを足すと「どの自然キーで集約をロードするか」が identity と乖離する。

## 影響

- pricing サブドメインに集約2つを新設する: `CustomerSellingPrice`（identity = `(CustomerId, ProductId)`）・`DeliveryLocationSellingPrice`（identity = `(DeliveryLocationId, ProductId)`）。各々が期間行子エンティティ・期間行 ID VO（branded）・Repository インターフェース・Prisma 実装・Mapper を持つ。
- テーブルは層ごとに親子2枚・計4枚。親は複合 PK ＋ 楽観ロック version（ADR-0039）、子は daterange ＋ EXCLUDE（ADR-0067）。原価列は持たない（原価非依存・ADR-0065 は「列の不在」で構造担保）。共通販売単価への FK・存在依存は張らない（同じ ProductId を ID 参照で結ぶ別集約・ADR-0066）。
- 命名は既存識別子に揃える: 納品先は本コードベースで一貫して `DeliveryLocation`（サブドメイン `delivery-location`・`DeliveryLocationId`）であり、CONTEXT.md 英訳の "Destination" は採らない（同義語を増やさない。CONTEXT.md を `DeliveryLocation-specific` へ修正済み）。
- 本スライス（#427）は スキーマ＋ドメイン＋Repository に限定し、時点解決（見積年月日で有効な単価を引く read）は価格決定フェーズ（B）の QueryService、マスタ画面は C へ送る（ADR-0066 の read 関心分離と整合）。
- B（価格決定）はこの2集約と共通販売単価を提出区分で選び分けて参照する。本決定により、その選び分けが型レベルで別物として表現される。
