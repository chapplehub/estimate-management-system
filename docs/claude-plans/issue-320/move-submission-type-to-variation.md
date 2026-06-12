# Issue #320: 提出区分（submissionType）を見積本体からバリエーション単位へ移動する — 実装計画

## 概要

提出区分（`submissionType`: 得意先宛 / 納品先宛）を `Estimate` 本体の属性から `EstimateVariation` 単位の属性へ移動する（ADR-0045）。スキーマ（列移動マイグレーション）、ドメイン層（属性・記述子の移設）、アプリ層（C1〜C4・C6 の入力組み替え）、インフラ層（マッパー・リポジトリ）、設計書（§7.5 / §5.3 / §7.2）を一貫して改訂する。

グリルセッション（/grill-with-docs）で Issue 本文から以下の差分が確定している:

- C2 は「入力組み替え」ではなく **`submissionType` の単純削除**（C2 はヘッダ専用コマンドでバリエーション記述子を持たないため）
- **C4 UpdateVariation を対象に追加**（`VariationContentDescriptor` から `submissionType` を型レベル除外）
- index は移動ではなく**廃止**
- 設計書は §7.5 に加え **§5.3 と §7.2 の最小修正**まで対象

実装完了時に上記差分を `docs/claude-plans/issue-320/deviations.md` へ記録する。

## 設計判断

いずれもグリルセッションで合意済み。判断 1〜3 の詳細な根拠は ADR-0045 に記録済み（ユーザー指示により起票）。

### 1. 提出区分の可変性

- A. C4 経由で変更可能にする（現行 C2 の変更機能をバリエーション単位で温存）
- B. 作成時のみ指定の不変属性とする（ミューテータ非提供）
- 採用: B。宛先を後から切り替える業務操作は存在しない（ユーザー確認済み）。不変性はバリデーションではなく「セッターが存在しない」構造で担保。誤作成の訂正経路は無効化（`VariationStatus.INACTIVE`）→作り直し

### 2. C2 UpdateEstimate の扱い

- A. C2 にバリエーションごとの提出区分リストを追加
- B. C2 の入力から `submissionType` を単純削除（移動先なし）
- 採用: B。C2 は「ヘッダ 6 項目＋税率系 2 項目」のヘッダ専用コマンドであり、その責務定義を壊さない

### 3. 保存属性 vs 導出属性

- A. 改訂系譜から「改訂先 = 得意先宛」と導出する
- B. 保存属性とする
- 採用: B。得意先宛バリエーションは改訂を経ず C1/C3 で直接作成できる（系譜なし）ため導出は原理的に不可能

### 4. index の扱い

- A. `@@index([submissionType])` を estimate_variations へ移動
- B. 廃止（再導入は要件駆動）
- 採用: B。2 値 enum の単独 index は選択率が低く実用しない。バリエーション絞り込みは常に `estimateId` 起点で既存複合 index で十分。利用クエリも現存しない

### 5. マイグレーション方式

- `prisma migrate dev --create-only` で生成 → SQL を手編集（nullable で列追加 → 親見積からバックフィル → NOT NULL 化 → 旧列・旧 index 撤去）
- `@default` は付けない（業務的に正しいデフォルト値が存在しない。現行 `estimates.submissionType` と同方針）
- 適用コマンド（`prisma migrate`）は deny されているためユーザーが `!` で実行する
- 留意: dev DB は全 worktree 共有のため、適用後は旧スキーマ前提の他ブランチ worktree（feat/issue-296 等）が dev DB に対して動かなくなる（了承済み）

### 6. 設計書の改訂範囲

- §7.5 のみ（Issue 記載）か、§5.3 / §7.2 まで含めるか
- 採用: §5.3 / §7.2 まで含める（最小修正に限定）。§7.2 の本格改訂は #296 に委譲

## ステップ

### Step 1: Prisma スキーマ＋マイグレーション

- 対象ファイル: `prisma/schema.prisma`, `prisma/migrations/{timestamp}_move_submission_type_to_variation/migration.sql`
- 作業内容:
  - `Estimate` モデルから `submissionType` 列と `@@index([submissionType])` を削除
  - `EstimateVariation` モデルに `submissionType SubmissionType @map("submission_type")` を追加（`@default` なし、index なし）
  - `prisma migrate dev --create-only`（ユーザーが `!` で実行）で生成した SQL を手編集:
    1. `ALTER TABLE "estimate_variations" ADD COLUMN "submission_type" "SubmissionType";`（nullable）
    2. `UPDATE "estimate_variations" ev SET "submission_type" = e."submission_type" FROM "estimates" e WHERE ev."estimate_id" = e."id";`
    3. `ALTER TABLE "estimate_variations" ALTER COLUMN "submission_type" SET NOT NULL;`
    4. `DROP INDEX "estimates_submission_type_idx";` ＋ `ALTER TABLE "estimates" DROP COLUMN "submission_type";`
  - 適用（`prisma migrate dev`）はユーザーが `!` で実行 → `pnpm db:generate`
- コミットメッセージ: `feat: submission_type 列を estimates から estimate_variations へ移動する（ADR-0045）`
  - ボディに記載する設計判断: バックフィル方式（デフォルト値なし・親見積から複写）、index 廃止の理由

### Step 2: ドメイン層 — EstimateVariation への属性移設

- 対象ファイル: `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`, `Estimate.ts`, `EstimateFactory.ts`
- 作業内容:
  - `EstimateVariation` に `submissionType` を追加（コンストラクタ＋getter のみ。**ミューテータは作らない**）
  - `Estimate` から `_submissionType` / `changeSubmissionType()` / getter を撤去（`create` / `reconstitute` 入力からも削除）
  - `EstimateVariationDescriptor` に `submissionType: SubmissionType` を追加
  - `VariationContentDescriptor` を `Omit<EstimateVariationDescriptor, "variationNumber" | "submissionType">` に変更
  - ドメイン層テスト（`Estimate.test.ts` / `EstimateFactory.test.ts` / `estimateAggregateBuilder.ts`）の組み替え
- コミットメッセージ: `feat: 提出区分を Estimate から EstimateVariation の不変属性へ移動する（ADR-0045）`
  - ボディに記載する設計判断: ミューテータ非提供による不変性担保、`Omit` による C4 入力の型レベル除外

### Step 3: アプリ層 — C1/C2/C3/C4 の入力組み替え

- 対象ファイル: `CreateEstimateCommand.ts`, `UpdateEstimateCommand.ts`, `AddVariationCommand.ts`, `UpdateVariationCommand.ts`（＋各テスト）
- 作業内容:
  - C1: バリエーション入力ごとに `submissionType: string` を持たせる（見積単位の入力を削除）
  - C2: 入力から `submissionType` を削除し、`changeSubmissionType` 呼び出しを撤去
  - C3: バリエーション入力に `submissionType: string` を追加
  - C4: 入力に `submissionType` が**含まれないこと**を確認（Step 2 の `Omit` で型保証）
- コミットメッセージ: `feat: C1-C4 の提出区分入力をバリエーション単位へ組み替える`

### Step 4: C6 複製 — バリエーション単位の継承

- 対象ファイル: `src/server/subdomains/estimate/domain/services/EstimateDuplicationService.ts`（＋テスト）, `DuplicateEstimateCommand.test.ts`
- 作業内容:
  - 見積単位の `submissionType` 継承（`input.source.submissionType`）を削除
  - 複製元バリエーションごとに `submissionType` を `CopiedVariationDescriptor` へ引き継ぐ（上書きなし・§5.3 準拠）
- コミットメッセージ: `feat: C6 複製の提出区分継承をバリエーション単位へ変更する`

### Step 5: インフラ層 — マッパー・リポジトリの読み書き組み替え

- 対象ファイル: `src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts`, `PrismaEstimateRepository.ts`
- 作業内容:
  - `toDomain`: バリエーション行から `SubmissionType.from()` で再構築（見積行からの読み取りを撤去）
  - `toPersistence` / insert / update: バリエーション書き込みに `submissionType` を含める
- コミットメッセージ: `feat: EstimateMapper/Repository の提出区分読み書きをバリエーション単位へ組み替える`

### Step 6: SubmissionType VO の docstring 修正＋全テスト確認

- 対象ファイル: `src/server/subdomains/estimate/domain/values/SubmissionType.ts`
- 作業内容:
  - docstring の §7.2 参照を「納品先宛**バリエーション**は申請・受注作成不可」のバリエーション単位の表現へ改める
  - `pnpm test` でフルスイートがパスすることを確認
- コミットメッセージ: `docs: SubmissionType の §7.2 参照をバリエーション単位の表現に改める`

### Step 7: 設計書改訂（§7.5 / §5.3 / §7.2）

- 対象ファイル: `docs/business/estimate/システム設計書(見積).md`
- 作業内容:
  - §7.5: `submissionType` を見積テーブルからバリエーションテーブルの記述へ移動
  - §5.3: 「提出区分」行を見積テーブル表→バリエーションテーブル表へ移動（備考「複製元バリエーションから継承」）
  - §7.2: 最小字句修正のみ — 「提出区分: 納品先 → 得意先」を「改訂元（納品先宛）は凍結のまま、得意先宛バリエーションを新規生成」へ、「複製」→「改訂」（用語集違反の是正）、ステップ3「得意先の見積のみ」→「得意先宛バリエーションのみ」
- コミットメッセージ: `docs: 設計書 §7.5/§5.3/§7.2 を提出区分のバリエーション単位移動に合わせて改訂する`

### Step 8: deviations.md の記録

- 対象ファイル: `docs/claude-plans/issue-320/deviations.md`
- 作業内容:
  - Issue 本文からの差分（C2 単純削除 / C4 追加 / index 廃止 / 設計書範囲拡張）を {元の計画内容} {実際の実装内容} {逸脱の理由} の形式で記録
- コミットメッセージ: `docs: issue-320 の計画逸脱を記録する`

## 備考

- CONTEXT.md（「提出区分」の不変性追記）と ADR-0045・INDEX.md はグリルセッション中に作成済み。未コミットなので Step 1 の前か適切なタイミングでドキュメントコミットに含める
- §7.2 の申請・受注作成不可ガードは未実装（値オブジェクトに判定メソッドのみ存在）。本 issue では実装しない（申請・受注の実装 issue で対応）
