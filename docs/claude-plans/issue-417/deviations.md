# Issue #417 実装計画からの逸脱記録

## 逸脱1: Submit/Preview の入力に estimateId を追加

- **元の計画内容**: コマンド/クエリの入力を `{ variationId, operatorEmployeeId, version }`（AC1＋§6.3）とし、estimateId は入力に取らない。
- **実際の実装内容**: 入力を `{ estimateId, variationId, operatorEmployeeId, version }` とする。
- **逸脱の理由**:
  - variationId から対象 Estimate を引く手段が存在しない（`EstimateRepository` は `findById(estimateId)` のみ。`EstimateQueryService` も variation 起点の検索を持たない）。
  - ADR-0068 の version 関門は `EstimateRepository.findById(estimateId)` で集約を版付きロードする前提のため、estimateId が必須。
  - 既存の全 variation 操作コマンド（`DeactivateVariationCommand` / `ActivateVariationCommand` / `UpdateVariationCommand` / `UpdateVariationMemosCommand`）が一様に `{ estimateId, variationId }` の両方を入力に取っており、この作法に揃える方が一貫する。確認モーダルは見積詳細画面から起動するため presentation 層は estimateId を保持する。
  - 代替案（`findByVariationId` 等の越境検索を新設）は AC1 の入力を維持できるが、#417 のスコープに新たな越境検索の実装・テストを増やすため不採用。

## 逸脱2: 申請コマンドの2ケースの統合テストを見送り（追補）

- **元の計画内容**: Step 7（申請コマンド）の統合テストで、attempt=2（差戻後の再申請）と EstimateApplicationPersistError（ケース2＝bump 成功・insert 失敗）も検証する想定だった。
- **実際の実装内容**: いずれも見送り、Step 7 では以下6ケースに絞って実 Prisma 統合テストを実装した（REQUIRED→申請＋ステップ列永続化、EXEMPT→免除1件・申請行なし、BLOCKED(NO_SUPERIOR_ROLE)→業務例外＋無永続化＋version据え置き、INACTIVE 拒否、兄弟前進拒否、stale version→ConflictError）。
- **逸脱の理由**:
  - **attempt=2**: 「差戻後の再申請」は前段に差戻（REJECTED）イベント行の生成オーケストレーションを要する。差戻ユースケースは #417 の範囲外で、その準備をテストに持ち込むとスコープが膨らむ。`nextAttempt` のロジック自体は単純（既存申請の最大 attempt+1）で、attempt=1 の経路でカバー済み。差戻ユースケース実装時に併せて検証するのが自然。
  - **ケース2（PersistError）**: 「bump 成功・insert 失敗」は insert 層への故障注入（モック/スタブ）が必要だが、本層はモック禁止（実 Prisma 統合）の方針。実 DB で insert を確定的に失敗させる手立てがなく、確定的・非フレーキーに再現できない。`EstimateApplicationPersistError` の文言・cause 保持は専用の単体テストで担保済み（errors/__tests__）。
