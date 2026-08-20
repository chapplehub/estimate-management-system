# Issue #547 実装 — 計画からの逸脱記録

## 1. 改訂（revise）系を Step 1 の PanelMode から Step 2 へ全面分離

### 元の計画内容
Step 1 の `PeriodDetailPanel.tsx` の記述で `PanelMode` を
`closed/new/edit/endDate/revise/delete` と列挙しており、`revise` 分岐が Step 1 に含まれるよう
読める。一方 Step 2 は「`PeriodDetailPanel` の `PanelMode` に `revise` 配線」とも書いており、
計画内で revise の配置 Step が自己矛盾していた。

### 実際の実装内容
revise を Step 1 から完全に除外し、Step 2 でまとめて配線した。
- Step 1: `PanelMode` は `closed/new/edit/endDate/delete`（revise なし）。`ReviseForm` 未作成、
  actions/schema に revise なし、「改定」ボタンなし。
- Step 2: `PanelMode` に `revise` を追加、`ReviseForm.tsx` 写像、revise action / `revisePeriodSchema`
  追加、「改定」ボタン＋ReviseForm JSX を配線。

### 逸脱の理由
CLAUDE.md「意味のあるまとまりでコミットし、各コミットを独立ビルド可能に保つ」に従うため。
Step 1 の PanelMode に `revise` を含めると `ReviseForm` の import が必要になり、Step 2 で作る
`ReviseForm.tsx` が未作成の時点でビルドが割れる。Issue 方針のコミット順（基本操作 → 改訂
ウィザード）とも整合し、Step 2 の「revise 配線」記述に寄せる形で解消した。挙動・最終成果物は
計画と同一で、Step 境界のみを明確化した。
