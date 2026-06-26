# Issue #440: 申請 submit の bump+insert を単一トランザクションで原子化し TOCTOU 窓を閉じる — 実装計画

## 概要

`SubmitApplicationCommand` の version 関門（`estimateRepository.update`）と申請挿入（`applicationRepository.insert`）が別トランザクションのため、「version が k+1 に進んだのに申請行がまだ可視でない」一瞬に、別バリエーションが兄弟チェックも version 関門も抜けて二重前進する TOCTOU 窓がある（ADR-0068 §残存リスク）。

これを **atomic submit**（bump+insert を単一トランザクションで原子化）で閉じる。集約またぎトランザクションは本コードベース初なので、DIP で `TransactionRunner` ポートを導入し、AsyncLocalStorage で tx を伝播する。意思決定は ADR-0069 に記録済み。

## 設計判断

会話（/grill-with-docs）で全て確定済み。以下は決定事項とその理由（再オープン不要）。

### 窓を閉じる機構
- 採用: **atomic submit**（bump+insert を1 tx で原子化）。
- 却下: full-merge（申請を見積集約へ取り込む）/ slot 同居（advancingVariationId を見積に持つ）/ DB バックストップ再導入。
- 理由: 「1見積1前進」が即時整合を要求するのは「どのバリが前進枠を占有するか」の1事実だけで、窓が噛むのは submit の一瞬。full-merge は ADR-0053/54/58/61 等の前提を崩し偽競合を生む（Vernon 集約則1×2 衝突の定石＝即時整合を要する最小データのみ同居）。詳細は ADR-0069。

### 集約またぎ tx の実現（DIP）
- 採用: `TransactionRunner` ポートを **`shared/application`** に置き、実装を `shared/infrastructure`。
- 理由: トランザクションは非ドメイン概念ゆえドメインに置かない（ADR-0039 の version=非業務概念と同型論法）。ポートのシグネチャは Prisma 型ゼロの thunk `run<T>(work)` にして漏れを防ぐ。

### tx 伝播の基盤
- 採用: **AsyncLocalStorage**。
- 却下: UnitOfWork（スコープ repo 生成）/ ClientManager（可変ホルダ）。
- 理由: repo コンストラクタ・コマンド構造・factory がほぼ不変（churn 最小）、かつ非同期コンテキストが並行チェーンを構造的に隔離するので並行安全（ClientManager のリクエストスコープ規律依存・シングルトン化の罠が無い）。

### repo 変換スコープ
- 採用: **最小（submit 参加3 repo のみ）** = estimate / application / exemption。
- 理由: 全面変換は #440 のスコープを膨らませる。未参加 repo は「次に tx に参加する時に currentClient へ移す」を ESLint と規約で担保する折衷。

### PersistError の扱い
- 採用: `EstimateApplicationPersistError` は**撤去**（原子化で「bump 成功・insert 失敗」が発生し得ない）。エラーは ConflictError と正常 union の2分岐に単純化。

## ステップ

### Step 1: TransactionRunner ポート + AsyncLocalStorage 基盤
- 対象ファイル:
  - `src/server/shared/application/transaction/TransactionRunner.ts`（新規・ポート）
  - `src/server/shared/infrastructure/transaction/txContext.ts`（新規・ALS / currentClient / runInTx / runAtomically）
  - `src/server/shared/infrastructure/transaction/PrismaTransactionRunner.ts`（新規・ポート実装）
- 作業内容:
  - `interface TransactionRunner { run<T>(work: () => Promise<T>): Promise<T> }`（Prisma 型ゼロ）
  - `currentClient()` = `als.getStore() ?? prisma`、`runInTx(tx, work)` = `als.run(tx, work)`
  - `runAtomically(work)` = ambient あれば work() / 無ければ `prisma.$transaction(tx => als.run(tx, work))`（join-or-open）
  - `PrismaTransactionRunner.run` = `prisma.$transaction(tx => runInTx(tx, work))`
- コミットメッセージ: `feat: 集約またぎトランザクション境界 TransactionRunner を AsyncLocalStorage で導入`

### Step 2: 参加3 repo を currentClient / runAtomically へ差し替え（最小スコープ）
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository.ts`
  - `src/server/subdomains/estimate/infrastructure/prisma/approval/PrismaEstimateApplicationRepository.ts`
  - `src/server/subdomains/estimate/infrastructure/prisma/approval/PrismaEstimateApprovalExemptionRepository.ts`
- 作業内容:
  - 多文メソッド（estimate `update`/`insert`/`insertWithCopies`/`delete`）: `prisma.$transaction(tx => ...)` を `runAtomically(async () => { const db = currentClient(); ... })` に置換、`tx.` を `db.` へ
  - 単文メソッド（application/exemption `insert`）: `prisma.xxx.create` を `currentClient().xxx.create` へ
  - **refetch / findById 等の全読み取りも `currentClient()` 経由**（read-your-writes 確保）
  - 素の `import prisma from "@server/prisma"` を削除
- コミットメッセージ: `refactor: 申請submit参加3リポジトリをcurrentClient/runAtomicallyへ移しambient tx相乗りを可能化`

### Step 3: ESLint で repo 内の素 prisma import を禁止
- 対象ファイル: `eslint.config.mjs`
- 作業内容:
  - infrastructure の repository 配下で `@server/prisma` の import を禁止（`no-restricted-imports` 等）。許可は `txContext.ts` / `PrismaTransactionRunner.ts` のみ
  - ambient tx を逃げる沈黙バグを構造的に防止
- コミットメッセージ: `chore(eslint): リポジトリ内の素prisma importを禁止しcurrentClient経由を強制`

### Step 4: コマンド配線（atomic submit）＋ PersistError 撤去
- 対象ファイル:
  - `src/server/subdomains/estimate/application/commands/SubmitApplicationCommand.ts`
  - `src/server/subdomains/estimate/application/factories/submitApplicationCommandFactory.ts`
  - `src/server/subdomains/estimate/application/errors/EstimateApplicationPersistError.ts`（削除）
  - PersistError を写像する Server Action / error-handler 側（撤去）
- 作業内容:
  - factory に `new PrismaTransactionRunner()` を注入
  - コマンドに `TransactionRunner` を DI し、step5-6（version 関門→挿入）を `txRunner.run(async () => { update; insert/exemption })` で原子化
  - 兄弟チェック（step2）・judge（step3）は tx 外のまま
  - `EstimateApplicationPersistError` と関連写像を撤去、エラーは ConflictError / 正常 union の2分岐へ
- コミットメッセージ: `feat: 申請submitのbump+insertを単一トランザクション化しTOCTOU窓を閉じる（ADR-0069）`

### Step 5: テスト
- 対象ファイル:
  - `PrismaEstimateRepository.test.ts` ほか参加 repo の統合テスト
  - `SubmitApplicationCommand.test.ts`
- 作業内容:
  - リポジトリ統合テスト: 「bump→insert 失敗時に version が進んでいない（ロールバック）」を逐次再現（原子性の実体は単一 `$transaction` の ACID。真の並行テストは主役にしない＝ADR-0039 のテスト方針踏襲）
  - コマンドテスト: `txRunner.run` 経由で bump+insert が呼ばれること、ConflictError 素通し、PersistError 撤去後の分岐を検証
- コミットメッセージ: `test: atomic submitの原子性（insert失敗でversionロールバック）と分岐を検証`
