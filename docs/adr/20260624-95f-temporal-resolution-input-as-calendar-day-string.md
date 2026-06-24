<!-- ファイル名: YYYYMMDD-sss-{slug}.md（sss は base36 3桁ランダム。例: 20260624-a3f-common-selling-price.md）。詳細は ADR-0000 を参照 -->

# ADR-20260624-95f: 販売単価の時点解決 QueryService は暦日文字列を入力に取り、見積年月日(Date)→JST 暦日の変換を価格決定側に置く

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-24 |
| 最終更新日 | 2026-06-24 |

## コンテキスト

#448 で共通販売単価の時点解決 QueryService（価格決定フェーズ B）を実装する。ADR-0066 で「時点解決は read 関心として QueryService に置く」と決め、本 issue ではその read 側を `applicable_period @> $date` で1行を直接引く方式に確定した（集約ロードなし・DTO 返却）。

ここで「時点」の入力型を決める必要がある。見積年月日はドメイン上 `Date`（瞬間／timestamptz・ADR-0010）で持つが、適用期間は `daterange`（暦日・半開区間 `[)`・ADR-0067）であり、解決は「ある暦日 D に効く単価は何か」という暦日の問いである。瞬間を暦日へ落とすには **タイムゾーンの選択**が不可避になる。

先行する時点解決である税率の `TaxRateRepository.findEffectiveAt(date: Date)` は `Date` をそのまま受ける。これは `effective_from`（timestamptz＝瞬間）同士の `lte` 比較で暦日変換が要らないモデルであり、daterange に対する暦日包含とは性質が異なる。「`Date` を受ける」前例をそのまま踏襲してよいかが論点になった。

A2（得意先別・納品先別販売単価）でも同型の時点解決 QueryService が3層ぶん並ぶため、ここで決めた入力契約と変換境界の置き場は3層に波及する。

## 検討した選択肢

### A. 入力を `"YYYY-MM-DD"` 暦日文字列にし、Date→JST 暦日変換を価格決定側に置く（採用）

QueryService の入力を `{ productId: string; date: string /* YYYY-MM-DD */ }` とし、`$queryRaw` では `applicable_period @> ${date}::date` とリテラルな暦日で判定する。見積年月日(`Date`)→JST 暦日の変換は QueryService の外＝価格決定（アプリケーション境界）に置き、本 issue では変換の置き場を確定するに留める。

### B. 入力を `Date` にし、QueryService 内部で暦日へ変換する（不採用）

税率 `findEffectiveAt(date: Date)` に倣い `Date` を受ける。暦日への変換を QueryService（infra）内で行う。`Date` を `$queryRaw ... ${date}::date` に渡すと、Postgres は timestamptz をセッション TZ で日付に丸めるため、JST 0:00（UTC 前日 15:00）が前日にずれる **off-by-one** をセッション TZ 次第で抱える。

## 決定

時点解決 QueryService の入力は `"YYYY-MM-DD"` 暦日文字列とし、見積年月日(`Date`)→JST 暦日の変換は QueryService の外＝価格決定側に置く（A を採用）。

## 根拠

- **SQL の安全性**: リテラルな `'2025-07-01'::date` は曖昧さゼロ。`Date` 直渡しはセッション TZ 依存の off-by-one を infra に抱え込む。暦日への丸めを SQL／infra に委ねない。
- **契約が型で正直**: `applicable_period` は暦日であり、リゾルバの問いは「瞬間 T に」ではなく「暦日 D に効く単価は何か」。文字列入力が型でその意味を語る。
- **変換は1箇所に集約**: 「見積年月日(Date)→JST 暦日」は業務暦の意味が分かる価格決定で一度だけ行う。`Date` 受けにすると A2 の3層 QueryService が各々で同じ変換を再演する。`FiscalYear.from(date)` が JST 変換を環境 TZ 非依存の純関数として1箇所に隔離している既存規律（ADR-0024）と揃える。
- **`findEffectiveAt(date: Date)` 前例は転用しない**: あれは timestamptz 同士の瞬間比較で暦日変換が無いモデル。daterange への暦日包含とは性質が異なり、`Date` 受けを踏襲する根拠にならない。

## 影響

- 呼び出し側（価格決定）に「`Date`→JST 暦日へ変換してから渡す」責務が生じる。これは欠点ではなく、TZ 換算の意味づけが分かる場所へ責務を明示的に置く設計判断である。
- A2 の得意先別・納品先別販売単価の時点解決 QueryService も同じ暦日文字列契約を踏襲する。JST 変換ヘルパが必要になれば、3層が共有する純関数（`FiscalYear` と同じく環境 TZ 非依存）として1箇所に置く。
- 半開区間 `[)` の包含意味論は daterange の値側（`dateRangeValue` の `'[)'`・ADR-0067）が保持する。`@>` 述語側には境界パラメータが無いため、暦日文字列を渡す限り境界の取り違えは生じない。
