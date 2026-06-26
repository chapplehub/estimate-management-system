# Issue #440: PR #463 レビュー対応（version 関門の軽量化・tx 規約簡素化・tx オプション明示）— 実装計画

## 概要

PR #463（atomic submit）へのマルチエージェントレビュー8件を吟味し、本 PR で対応する3件に絞った後続実装。

1. **専用 `bumpVersion` 導入（元レビュー🟠・実質最優先）**: submit の version 関門が `estimateRepository.update()`（全 variation/item/setGroup/component/revision/repair の deleteMany+upsert 一式＋末尾 refetch）を呼んでいる。submit は scalar を一切変更しないため純粋な無駄で、直列化トランザクション内に置かれたことで対象見積配下の全行ロックを窓全期間保持している。根への条件付き `updateMany`（WHERE id AND version, increment）1文に置き換え、ロック行数・トランザクション長・デッドロック確率を縮める。
2. **`run()` → `runAtomically` 委譲（元レビュー🟡簡素化）**: `PrismaTransactionRunner.run` が `runInTx` 経由で常に新規 tx を開き、ambient tx に join しない。`runAtomically` の join-or-open と「$transaction を開いて ALS へ seed する」ロジックが二重化している。`run()` を `runAtomically(work)` へ委譲し、重複解消と join 安全性を同時に得る。
3. **`transactionOptions` の明示（元レビュー🔴の安価な部分のみ）**: `prisma.ts` が `transactionOptions` 無指定で、対話トランザクションが Prisma 既定（timeout 5s / maxWait 2s）で動く。値を明示して意図を可視化する。

**本 PR で対応しないもの（follow-up / 記録のみ）**:
- P2028 → ConflictError マップ（タイムアウトは競合ではなく再読込で解決しないため却下）
- 冗長 `findByVariationId` 削減（効果が DB 1往復のみ・tx 内外の一貫性注意が要る）
- 楽観ロック/P2002 共有ヘルパ寄せ（ヘルパが pricing 配下にあり shared 移設が前提＝別 PR。文言差は append-only ゆえの意図的区別）
- トランザクション規約2併存（ambient vs 明示）の統一（増分移行の過渡状態）
- 原子性2部構成の footgun 完全機械強制（過剰）

## 設計判断

### `bumpVersion` の引数
- A. `bumpVersion(estimate: Estimate, expectedVersion: number)`（`update` と同形）
- B. `bumpVersion(estimateId: EstimateId, expectedVersion: number)`（id + version のみ）
- 推奨: **B**。submit は scalar/children を一切変更しないため集約全体を渡す必要がなく、「version 関門専用＝根の version だけを進める」という意図を最小引数で型に表現する。集約を受け取ると「集約も書き戻すのでは」という誤読を招く。

### `bumpVersion` の戻り値
- A. `Promise<void>`
- B. `Promise<Estimate>`（`update` と同形・refetch して返す）
- 推奨: **A（void）**。`SubmitApplicationCommand` は現状 `update` の戻り値を未使用。refetch を返すと「全行ロックを縮める」という本対応の目的に反する余計な read が復活する。競合時は従来どおり `ConflictError` を throw。

### `bumpVersion` の競合メッセージ
- `count === 0` は version 不一致・行消失の両方を覆う。`update` 既存文言「他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。」を踏襲する（同一意味・同一導線）。

### `runInTx` の扱い
- `run()` を `runAtomically` へ委譲すると `runInTx` の唯一の利用者が消える。
- 推奨: **`runInTx` を削除**（未使用 export を残さない）。併せて `PrismaTransactionRunner` から `prisma` import も外れ、`runAtomically` のみに依存する形へ単純化される。

### `transactionOptions` の具体値
- A. Prisma 既定を明示踏襲（timeout 5000ms / maxWait 2000ms）
- B. 余裕を持たせて延長（例 timeout 10000ms）
- 推奨: **A（既定の明示踏襲）**。本 PR の bumpVersion 化で tx は逆に短くなるため、まず既定値を明示して「無指定の暗黙依存」を解消するに留める。延長が要るかは bumpVersion 後の実測で別途判断。
- 補足: P2028 のエラーマッピングは本 PR スコープ外（却下済み）。

### bumpVersion の配置と既存 `update` の関係
- `update`（編集画面の集約保存）はそのまま残す。`bumpVersion` は version 関門専用の別メソッドとして追加し、submit のみが使う。両者を統合しない（責務が異なる: 集約全体保存 vs version トークンだけ前進）。

## ステップ

### Step 1: `bumpVersion` をドメインインターフェースへ追加
- 対象ファイル: `src/server/subdomains/estimate/domain/repositories/EstimateRepository.ts`
- 作業内容:
  - `bumpVersion(estimateId: EstimateId, expectedVersion: number): Promise<void>` を追加
  - JSDoc に「version 関門専用。scalar/children は書き換えず根の version のみ条件付きで進める。不一致/行消失は ConflictError（ADR-0039・ADR-20260626-dee）」を記載
- コミットメッセージ: `feat: EstimateRepository に version 関門専用 bumpVersion を追加`

### Step 2: `PrismaEstimateRepository.bumpVersion` を TDD で実装
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/prisma/__tests__/PrismaEstimateRepository.test.ts`
  - `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository.ts`
- 作業内容（vertical slice で1テスト→1実装を反復）:
  - RED→GREEN: 正常系（expectedVersion 一致で version が +1 され、子テーブルへ一切書き込まない＝他行の updated_at 不変）
  - RED→GREEN: 競合系（stale な expectedVersion で `ConflictError`）
  - RED→GREEN: ambient tx 内で bumpVersion 後に後続失敗 → version がロールバック（atomic submit 基盤の継続検証）
  - 実装: `runAtomically` 内で `currentClient().estimate.updateMany({ where: { id, version: expectedVersion }, data: { version: { increment: 1 } } })`、`count === 0` で既存文言の `ConflictError`
- コミットメッセージ: `feat: PrismaEstimateRepository.bumpVersion（根の条件付き version インクリメント）`

### Step 3: `SubmitApplicationCommand` の version 関門を `bumpVersion` へ差し替え
- 対象ファイル:
  - `src/server/subdomains/estimate/application/commands/__tests__/SubmitApplicationCommand.test.ts`
  - `src/server/subdomains/estimate/application/commands/SubmitApplicationCommand.ts`
- 作業内容:
  - tx 内 `this.estimateRepository.update(loaded.estimate, input.version)` を `this.estimateRepository.bumpVersion(loaded.estimate.id, input.version)` へ置換
  - 既存テスト（atomic rollback / stale ConflictError）が新メソッドで緑であることを確認。フェイク repo に `bumpVersion` を実装
  - クラス JSDoc の「全集約 update」前提の記述を「version 専用 bump」へ更新
- コミットメッセージ: `refactor: submit の version 関門を全集約 update から bumpVersion へ軽量化`

### Step 4: `PrismaTransactionRunner.run` を `runAtomically` へ委譲し `runInTx` を削除
- 対象ファイル:
  - `src/server/shared/infrastructure/transaction/PrismaTransactionRunner.ts`
  - `src/server/shared/infrastructure/transaction/txContext.ts`
- 作業内容:
  - `run<T>(work)` を `return runAtomically(work)` へ変更（`prisma`・`runInTx` import を除去）
  - `txContext.ts` から未使用になる `runInTx` を削除
  - 既存のリポジトリ統合テスト（外側 tx ロールバック）が緑を維持することを確認
- コミットメッセージ: `refactor: PrismaTransactionRunner.run を runAtomically へ委譲し runInTx 重複を解消`

### Step 5: `transactionOptions` を明示
- 対象ファイル: `src/server/prisma.ts`
- 作業内容:
  - `new PrismaClient({ adapter, transactionOptions: { timeout: 5000, maxWait: 2000 } })` を設定し、無指定の暗黙依存を解消するコメントを添える
- コミットメッセージ: `chore: PrismaClient の transactionOptions（timeout/maxWait）を明示`

### Step 6: 検証と逸脱記録
- 作業内容:
  - `pnpm test` / `tsc --noEmit` / `pnpm lint` をグリーン確認
  - レビュー由来の対応であること・スコープ判断（採用3件 / 見送り5件）を `docs/claude-plans/issue-440/deviations.md` へ追記
- コミットメッセージ: `docs: PR #463 レビュー対応のスコープ判断を deviations へ記録`
