# 計画からの逸脱記録

## 逸脱 1: 「#345 = 純フロント」前提を破棄し EstimateSummaryDTO を additive 拡張（Q1-b）
- **計画**: 元の issue #345 は「見積一覧画面（フロントエンド）」であり、当初は presentation 層のみ（純フロント）で完結させ、BE の read model（`EstimateSummaryDTO` / `PrismaEstimateQueryService`）には手を入れない想定だった。
- **実際**: 一覧に「納品先」列を出すため、凍結契約 `EstimateSummaryDTO` に `deliveryLocationName: string` を additive 追加し、`ESTIMATE_SUMMARY_INCLUDE` に `deliveryLocation: { select: { name: true } }`、`toSummaryDTO` に `e.deliveryLocation.name` の解決を加えた（commit ea4218e）。表示は名前のみのため `deliveryLocationCode` は足さない（Q1 の得意先コード非表示方針と一貫・YAGNI）。grill-with-docs の Q1-b で BE 拡張を採用と合意し、保存済み計画にも反映済み。
- **理由**: 既存 `EstimateSummaryDTO` は納品先を一切持たず、純フロントのままでは一覧に納品先名を表示できない。名前解決は ADR-0013 の「リレーション越しの名前解決」既存パターンに従う additive 変更で、後方互換を壊さない（`Estimate.deliveryLocationId` は NOT NULL のため全行が必ず納品先を持ち、required で追加して presentation 側の null 分岐を不要にできる）。新規 ADR は不要（不可逆性・驚き・真のトレードオフの 3 条件を満たさない）。
