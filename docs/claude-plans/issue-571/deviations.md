# Issue #571 実装計画からの逸脱記録

CLAUDE.md 規約に基づき、計画（`search-estimate-applications-query.md`）と異なる対応を記録する。

## 1. 行DTOに identity 列 `variationId` を追加（表示10列＋1）

- **元の計画**: `EstimateApplicationSummaryDTO`（10項目）＝見積番号・バリエーション番号・得意先名・納品先名・提出区分・税込合計金額・申請状態(code+label)・承認待ち役割名・申請者名・申請日時。
- **実際の実装**: 上記10列に加え、行の identity として `variationId: string` を1フィールド追加した（表示列ではない）。
- **逸脱の理由**: FE の一覧はバリエーション単位の行で、React の key と詳細画面遷移に安定した identity が要る。既存の `EstimateSummaryDTO` も表示列とは別に `estimateId` を identity として持つ前例に倣った。DTO 契約の追加であり、10表示列の意味論は不変。

## 2. `selectApplicationRows` の limit は「与えられた件数をそのまま切り出す」契約に確定

- **元の計画 / ADR-20260707-b36**: 「先頭 `LIST_FETCH_LIMIT+1` 件を切り出す」と記述。
- **実際の実装**: 純粋関数 `selectApplicationRows(rows, conditions, limit)` は与えられた `limit` をそのまま先頭から `slice` する。`+1`（切り捨て検出のための1件多い取得）を渡すか否かは呼び出し側（presentation）の関心とし、純粋関数の契約から外した。
- **逸脱の理由**: 既存の一覧（`PrismaEstimateQueryService` / products 等）は presentation が `LIST_FETCH_LIMIT` を素直に渡し `+1` の hasMore パターンを持たない。DTO 契約にも `hasMore` フラグは無い。純粋関数に `+1` を埋め込むと「limit の意味」が二重化するため、`limit` は「切り出し件数」の一次的意味に統一し、`+1` を使うかは将来 presentation が決められるようにした。ADR の帰結（limit は DB take ではなくフィルタ・ソート後に適用）は保持している。

## 3. Step 5 の統合テストは QueryService 実装を直接検証

- **元の計画**: テストファイル名 `SearchEstimateApplicationsQuery.test.ts`（実DB統合）。
- **実際の実装**: 同名ファイルで、`SearchEstimateApplicationsQuery`（Step 6 で新設する薄い委譲）ではなく、その委譲先である `PrismaEstimateApplicationSearchQueryService` を直接 `new` して `search` を検証した。
- **逸脱の理由**: Step 5 時点で Query ラッパは未作成であり、読み取り挙動の実体は QueryService 実装が全て担う。#559 の Query が passthrough なのと同様、実体を直接検証する方が意味論に忠実。Query ラッパ（Step 6）は型検査＋factory 配線で担保し、重複した実DB統合テストは設けなかった。
