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

---

# PR #463 レビュー対応の実装記録

計画: `docs/claude-plans/issue-440/review-followups-bump-version-and-tx-options.md`
実装方式: `/tdd`（テスト→実装の縦スライス）

atomic submit（上記）の PR #463 に対するマルチエージェントレビュー8件を吟味し、採用3件を本 PR へ追加実装した。

## レビュー指摘のスコープ判断（採用3件 / 見送り5件）

採用（本 PR で対応）:
1. **version 関門の bumpVersion 化（元レビュー🟠）**: submit は Estimate 本体を変更しないのに `update()` が全集約 deleteMany/upsert＋refetch を発行し、直列化トランザクション内で全行ロックを保持していた。根の version だけを進める `bumpVersion` を新設して差し替え。
2. **`run()` の `runAtomically` 委譲（元レビュー🟡）**: `PrismaTransactionRunner.run` が常に新規 tx を開き、`runAtomically` の join-or-open と二重化していた。委譲に変更して重複解消＋join 安全性確保。未使用化した `runInTx` を削除。
3. **`transactionOptions` 明示（元レビュー🔴の安価な部分）**: 既定値（timeout 5s / maxWait 2s）を明示。

見送り（follow-up / 却下）:
- **P2028 → ConflictError マップ（元レビュー🔴の主張部分・却下）**: タイムアウトは競合ではなく再読込で解決しないため、ConflictError へのマップは意味的に誤り。値の明示のみ採用。
- **冗長 `findByVariationId` 削減（元レビュー🟠・見送り）**: 効果が DB 1往復のみ。かつ兄弟チェック（tx 外）の結果を採番（tx 内）へ流用すると read-your-writes 一貫性を損なうため、安易な共有を避けた。
- **楽観ロック/P2002 共有ヘルパ寄せ（元レビュー🟡・別 PR）**: 共有先 `assertVersionBumped`/`translateInsertConflict` は pricing サブドメイン配下にあり、estimate から使うには `shared` への移設が前提＝別 PR 相当。なお「文言ドリフト」指摘は誤り（application repo は append-only ゆえ「更新されています」、estimate repo は削除あり得るため「更新または削除されています」とコメントで意図的に使い分けている）。
- **トランザクション規約2併存（ambient vs 明示・元レビュー🟡・記録のみ）**: 増分移行の過渡状態。pricing を集約またぎ tx に参加させる将来時点で統一を判断。
- **原子性2部構成の footgun 完全機械強制（元レビュー🟡・記録のみ）**: `currentClient()` は使ったが `runAtomically` で囲み忘れると部分コミットし得る。join-or-open パターン固有の落とし穴で、完全な機械強制は過剰。リスクの言語化に留める。

## 逸脱: bumpVersion の引数を id+version に絞った

- **計画どおり**: 計画の設計判断（案B）に従い `bumpVersion(estimateId: EstimateId, expectedVersion: number)` とした。集約全体を渡す案 A は「集約も書き戻すのでは」という誤読を招くため不採用。戻り値は void（command は戻り値未使用、refetch を返すと縮めたロックが復活する）。
- 逸脱なし（計画の推奨どおり実装）。
