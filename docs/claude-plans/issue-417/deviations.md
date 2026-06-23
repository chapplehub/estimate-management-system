# Issue #417 実装計画からの逸脱記録

## 逸脱1: Submit/Preview の入力に estimateId を追加

- **元の計画内容**: コマンド/クエリの入力を `{ variationId, operatorEmployeeId, version }`（AC1＋§6.3）とし、estimateId は入力に取らない。
- **実際の実装内容**: 入力を `{ estimateId, variationId, operatorEmployeeId, version }` とする。
- **逸脱の理由**:
  - variationId から対象 Estimate を引く手段が存在しない（`EstimateRepository` は `findById(estimateId)` のみ。`EstimateQueryService` も variation 起点の検索を持たない）。
  - ADR-0066 の version 関門は `EstimateRepository.findById(estimateId)` で集約を版付きロードする前提のため、estimateId が必須。
  - 既存の全 variation 操作コマンド（`DeactivateVariationCommand` / `ActivateVariationCommand` / `UpdateVariationCommand` / `UpdateVariationMemosCommand`）が一様に `{ estimateId, variationId }` の両方を入力に取っており、この作法に揃える方が一貫する。確認モーダルは見積詳細画面から起動するため presentation 層は estimateId を保持する。
  - 代替案（`findByVariationId` 等の越境検索を新設）は AC1 の入力を維持できるが、#417 のスコープに新たな越境検索の実装・テストを増やすため不採用。
