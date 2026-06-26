# Issue #440 実装の計画からの逸脱記録

計画: `docs/claude-plans/issue-440/atomic-submit-cross-aggregate-transaction.md`
実装方式: `/tdd`（テスト→実装の縦スライス）

## 逸脱1: コミット境界（Step 単位 → 振る舞い単位の縦スライス）

- **元の計画**: Step1（基盤3ファイル）/ Step2（参加3 repo 変換）/ Step5（テスト）をそれぞれ独立コミットに分ける（水平スライス）。
- **実際の実装**: /tdd の縦スライス（1振る舞い＝RED→GREEN）に従い、テストと実装を同一コミットへ束ねた。
  - commit A（feat 基盤）: TransactionRunner ポート＋txContext＋PrismaTransactionRunner ＋ **estimate repo 変換** ＋ estimate ロールバックテスト。
  - commit B（refactor）: application / exemption repo 変換 ＋ 各 repo のロールバックテスト。
  - commit C（feat 配線）: コマンドの atomic submit 配線 ＋ PersistError 撤去 ＋ コマンドテスト。
  - commit D（chore）: ESLint ガード。
- **逸脱の理由**: /tdd は「全テストを先に書いてから全実装」（水平スライス）を明確に禁止し、1振る舞いずつ RED→GREEN する縦スライスを要求する。計画の Step 境界（基盤／repo／テストを分離）は水平的なので、テストを各振る舞いの実装と同じコミットに同居させた。estimate repo 変換を基盤コミットへ前倒ししたのは、トレーサ弾（外部 tx での bump ロールバック）を通す最小実装が「基盤＋estimate repo 変換」だったため。

## 逸脱2: ESLint ガードの適用範囲（infrastructure 全 repo → 参加3ファイル限定）

- **元の計画**: Step3 で「infrastructure の repository 配下で `@server/prisma` の import を禁止」。
- **実際の実装**: 禁止対象を atomic submit 参加3ファイル（`PrismaEstimateRepository` / `PrismaEstimateApplicationRepository` / `PrismaEstimateApprovalExemptionRepository`）に**限定**した。`eslint.config.mjs` に `atomicSubmitRepositoryFiles` を新設し、そのファイル群にのみ `no-restricted-imports` の `paths` で `@server/prisma` を禁止。
- **逸脱の理由**: 現状 36 ファイルが `@server/prisma` を直接 import しており、その大半は #440 のスコープ外（未変換）の正当な repo / queryService。infrastructure 全体へ一律禁止すると未変換 repo がすべて壊れ、最小スコープ（参加3 repo のみ変換）という計画の repo 変換方針自体と矛盾する。ガードの本来の狙い（変換済み repo での ambient tx 逃げの再発防止）は参加3ファイルに限定すれば達成できる。
- **付随対応**: ESLint flat config はルールオプションをマージせず置換するため、参加3ファイル向けオーバーライドで `no-restricted-imports` を再宣言すると既存の集約境界 `patterns` ガードが失われる。これを防ぐため `patterns` を `aggregateChildImportPatterns` const に括り出し、グローバルルールとオーバーライドの双方で共有した。
