# Issue #587: 実装計画からの逸脱記録

計画（`introduce-app-router-error-boundaries.md`）および ADR-20260721-ef0 と、実際の実装との差分を記録する。

## 逸脱1: `global-error.tsx` を `globals.css` の Tailwind クラスではなく inline style で描画した

### 元の計画内容

- 計画 Step 5（`introduce-app-router-error-boundaries.md`）:「重い UI 依存（shadcn/フォント/共通 ErrorFallback）を持たず、`globals.css` の Tailwind クラスのみで素朴に描画」
- 計画 設計判断・共通化節:「`global-error` は重い UI 依存を持たず自己完結（`globals.css` の Tailwind クラスのみで自前描画）」
- ADR-20260721-ef0 決定3（修正前）:「`globals.css` の Tailwind クラスのみで素朴に自前描画する」

### 実際の実装内容

- `src/app/global-error.tsx` は `globals.css` を **import せず**、すべて inline `style` 属性で `<html><body>` から自前描画する（Tailwind クラスを一切使わない）。

### 逸脱の理由

`global-error` は Next.js の規約上、ルート `layout.tsx` を丸ごと置換して全画面を描画する。`globals.css` は `src/app/layout.tsx` の `import "./globals.css"` によって読み込まれるが、`global-error` レンダリング時はその `layout.tsx` 自体が置換されるため **この import は走らず、Tailwind クラスが適用される保証がない**。

したがって計画・ADR の字面「`globals.css` の Tailwind クラスのみで描画」は技術的に成立しない。inline style による自己完結は、ADR 決定3 の**趣旨**（共通 `ErrorFallback`／shadcn／フォント等の依存が壊れても最終防波堤が共倒れせず「依存ゼロで単独で必ず描ける」）に**むしろ忠実**であり、CSS が一切効かなくても文意が壊れない、より堅牢な構成である。

### 対応

- 実装は正（コード修正は不要）。
- ADR-20260721-ef0 決定3 の文言を実態（inline style で自己完結・`globals.css` 非 import）と根拠（root layout 置換で `globals.css` が走らない）に合わせて更新済み。
- 計画ファイルの該当記述は履歴として残し、正本は本 deviations.md と更新後の ADR 決定3 とする。
