# 実装計画からの逸脱記録（#429）

計画: `docs/claude-plans/issue-429/round1-data-boundary-and-list-screen.md`

## 逸脱1: `queries.ts` の `import "server-only"` を省略

- **元の計画**: `_data/queries.ts` 冒頭に `import "server-only";` を置き、クライアントコンポーネントへの誤import時にビルドエラーで弾く。
- **実際の実装**: 当該importを省略し、コメントで方針を明記。
- **逸脱の理由**: 本リポジトリは `server-only` パッケージを未導入（`require.resolve('server-only')` が解決不能、既存クエリ層にも使用例なし）。importするとビルドが壊れる。サーバ専用性は Server Component（`page.tsx`）経由の利用で担保し、リポジトリ全体の既存慣習（server-only 不使用）に揃えた。導入是非は本スライスのスコープ外。

---

# ラウンド2の逸脱

計画: `docs/claude-plans/issue-429/round2-detail-and-period-form.md`

## 逸脱2: 削除確認を独立コンポーネント `PeriodDeleteConfirm.tsx` に分離（計画の4ファイル→5ファイル）

- **元の計画**: ファイル構成は `PeriodForm` / `PeriodDetailPanel` / `actions.ts` / `schema.ts` の4点。削除は wrapper のモード `delete` で行内2段階確認（決定5）。
- **実際の実装**: 行内確認を `PeriodDeleteConfirm.tsx` として独立コンポーネント化（計5ファイル）。
- **逸脱の理由**: 行内確認は `useActionState`（または `useServerForm`）を必要とし、これは期間行の `.map()` ループ内では React フック規則違反になる。1行=1フックを成立させるには行単位コンポーネントへ切り出すしかない。挙動・依存（決定5の「AlertDialog不使用・client state流用」）は計画どおりで、配置のみの逸脱。

## 逸脱3: 適用終了の「本日以降」「終了>開始（厳密）」をミューテータに追加

- **元の計画**: 決定6で zod 層の単項目規則を「開始必須/実在日・終了>開始(厳密)・単価≥0整数」と列挙。適用終了固有の制約は明示列挙されていなかった。
- **実際の実装**: `endDateCurrentPeriod` ミューテータに「終了日は本日以降」（use-cases.md §4「今日以降で適用終了」）と「終了>開始（厳密）」を追加。
- **逸脱の理由**: (1) 適用終了は「以後適用しなくする」操作であり、過去で締めて現在の有効性を遡及的に消すのを防ぐには本日以降の制約が必須（use-cases.md §4 が要求）。(2) 終了>開始は決定6で確定済みだが、適用終了モードでは開始日をフォーム契約に含めない（改竄不能化・決定3）ため zod では検証不能。ストア上の真の開始日でサーバ側判定する必要があり、ミューテータに配置した（本日開始行を本日締めの空区間 [本日,本日) も弾く）。

## 逸脱4: 書き込み Server Action の認可を `verifyAdmin` に固定

- **元の計画**: グリルでは認可主体を明示確定していない（読み取りページは `verifySession`）。
- **実際の実装**: 4つの書き込み Action はすべて `verifyAdmin`。
- **逸脱の理由**: 本リポジトリの既存マスタ系 mutation（products/departments/employees 等）はすべて `verifyAdmin` で統一されており、共通売単価の保守も同種のマスタ保守として揃えた。読み取り（一覧・詳細）は従来どおり `verifySession`。要件で保守担当者≠管理者と判明した場合は本スライスのスコープ外で見直す。
