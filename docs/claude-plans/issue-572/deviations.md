# Issue #572 実装計画からの逸脱記録

計画（`estimate-application-list-screen.md`）に対し、実装中に補った判断を記録する。
いずれも計画の意図の範囲内の具体化で、方式の変更ではない。

## 1. 状態フィルタの選択肢を application 層に新設

- **元の計画**: Step 4「SearchForm に本画面の searchFields（… multiselect状態 …）を渡す」。
  状態選択肢（code+label）の供給元は計画に明記なし。
- **実際の実装**: `src/server/subdomains/estimate/application/queries/variationApplicationStateOptions.ts`
  を新設し、`SEARCHABLE_VARIATION_APPLICATION_STATE_OPTIONS`（NONE を除く 5 値・VO の `.label` から生成）
  を公開。page.tsx はこれを import して multiselect options に写す。
- **理由**: 行を伴わない検索フィルタは行 DTO の `applicationState.label` を使えない。label の単一ソースは
  ドメイン VO（ADR-0069）だが、presentation は domain を直 import 禁止（DDD 層規則）。両立解として
  application 層が VO から選択肢配列を組み立てて公開する（application→domain 依存は許容・行 DTO と
  同じ源ゆえドリフトしない）。FE でのラベルハードコード（ADR-0069 違反）を避けるための具体化。

## 2. 提出区分ラベル・整形ヘルパを本機能ローカルに配置

- **元の計画**: Step 4 で columns.tsx を新設する記述はあるが、ラベル/整形ヘルパの置き場所は未指定。
- **実際の実装**: `src/app/(features)/estimate-applications/_components/labels.ts` に
  `SUBMISSION_TYPE_LABELS` / `formatYen` / `formatDateTime` をローカル配置。
- **理由**: Step 1 で app 直下へ昇格したのは複数画面共有の日付・バッジヘルパのみ（意図的に labels は
  対象外）。提出区分ラベル・金額/日時整形は本一覧固有のため、estimates が自前の `_shared/labels.ts` を
  持つのと同じ流儀でローカルに閉じる（昇格の判断境界と整合）。申請日時は date+time 整形が必要で
  既存 `formatDate`（日付のみ）と要件が異なる点も、共有ではなくローカル新設を後押しした。
