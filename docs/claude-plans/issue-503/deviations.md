# Issue #503 実装計画からの逸脱記録

計画: `cost-price-maintenance-screen.md`

## 逸脱1: PR1 では page → PeriodDetailPanel へ referenceDate を渡さなかった

- **元の計画内容**: Step3（PR1）の page.tsx は共通売単価ミラーとして `referenceDate` を算出し
  `PeriodDetailPanel` へ渡す（status 算出とタイムラインの今日マーカーを共有）想定だった。
- **実際の実装内容**: PR1 のパネルはタイムライン非搭載（縮小版）で `referenceDate` を消費しないため、
  page は `referenceDate` を **読みモデルクエリ用途のみ**に使い panel へは渡さなかった。Step6（PR2）で
  タイムライン組み込み時に Props へ `referenceDate` を復活させ page から渡す形へ戻した。
- **逸脱の理由**: PR を2本に分ける計画上、PR1 は `PriceTimeline`/`ReviseForm` 未作成の状態で単体 build・
  出荷可能でなければならない。未使用 prop を PR1 で渡すと no-unused-vars を招くため、消費が生まれる PR2 まで
  受け渡しを遅延させた。最終状態（PR2 完了時）は計画通り page 由来の同一基準日を panel と共有する。

## 判断記録（計画の選択肢内・厳密には逸脱ではない）

### timeline-layout 昇格時の priceLabel 生成方針
- 計画 Step5 は「`priceLabel` 生成は price フィールドの引数化 or 呼び出し側整形のいずれか実装時に判断し、
  逸脱があれば記録」と明示していた。
- **採用**: price フィールド引数化（中立型 `TimelinePeriod.price` は10進文字列、`priceLabel` は
  `computeTimelineLayout` 内で `formatYenFromDecimal` 生成）。
- **理由**: 円整形をタイムライン算出の1箇所へ集約でき、単体テストで `priceLabel` を直接検証できる。
  呼び出し側は各 DTO の `sellingPrice`/`costPrice` を `price` へマップして渡し、集約 DTO 同士の結合を作らない。
  計画が許容した選択肢の範囲内であり、驚きはない。

## PR 構成（計画通り）
- PR1（`feat/issue-503`）: Step1 昇格 → Step2 schema/actions → Step3 詳細＋期間CRUD
- PR2: Step4 単価改定 → Step5 timeline-layout 昇格 → Step6 タイムライン表示
