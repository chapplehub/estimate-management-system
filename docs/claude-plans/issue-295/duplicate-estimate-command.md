# Issue #295: C6 DuplicateEstimate（見積複製・集約またぎ）をドメイン+アプリ層で実装する — 実装計画

## 概要

複製元 Estimate から選択したバリエーション群を、新採番の新しい Estimate 集約として複製する C6 DuplicateEstimate を、ドメイン層（複製ロジック + 系譜 `EstimateVariationCopy` 生成）とアプリ層（コマンド・ファクトリ）の縦スライスで実装する。

複製元と新見積は**別々の集約インスタンス**であり、系譜（複製先バリエーション → 複製元バリエーション）はどちらの集約にも属さない兄弟成果物として扱う。C6 は複製ボタン押下で即座にサーバ側で複製集約を構築し、新採番して保存する（採番・保存をオーケストレーション）。複製直後の見積は「単価0・申請/受注レコードなし＝導出ステータス作成中」の有効な Estimate であり、専用エンティティは設けない。

`/grill-with-docs` で合意。CONTEXT.md（用語集）と ADR-0040 / 0041 / 0042 を伴う。

## 設計判断

会話で確定済み（詳細根拠は各 ADR 参照）。

### 複製ロジックのドメイン配置
- 採用: **ドメインサービス** `EstimateDuplicationService`（複製の業務判断）＋ `EstimateFactory.duplicate`（子構築・系譜ペア化）。
- 理由: 2集約をまたぐ操作の業務判断はサービスに、子エンティティ構築は集約境界規約（ADR-0027/0036）によりファクトリに閉じ込める。

### 系譜 EstimateVariationCopy の集約帰属（→ ADR-0040）
- 採用: 集約外の兄弟成果物。サービスが `{ estimate, copies }` を返す。
- 理由: 書き込みモデル集約を編集可能状態に限定。複製元表示は読み取りモデル側の関心事。

### 系譜の永続化（→ ADR-0040）
- 採用: `EstimateRepository.insertWithCopies(estimate, copies)` で 1 トランザクションのアトミック保存。
- 理由: トランザクションはリポジトリ内部完結（UoW 無し）という既存構成の枠内で原子性を確保。

### 系譜のキー設計（→ ADR-0041）
- 採用: サロゲート id を削除し `copiedVariationId` を主キーにする自然キー化。ドメインは値オブジェクト。
- 理由: `copiedVariationId → sourceVariationId` の関数従属が成立する非対称な関連で、複製先が完全な自然キー。

### 空選択（見積のみ複製）の扱い（→ ADR-0042）
- 採用: C6 は最低 1 バリエーション選択を要求（0 件は `BusinessRuleViolationError`）。
- 理由: 空見積不可（§C1）は全パスで効く構造的不変条件。「見積のみ複製」は将来プレゼン層へ分離。

### 引き継ぎ/更新/クリアの確定
- 継承（複製元から）: estimateType（同型の新番号を採番）/ submissionType / customer / deliveryLocation / taxRoundingType / 修理・事後詳細（新idでディープコピー）/ 品目・数量・メモ / **discountRate（率）**。
- 更新（アプリ供給）: estimateDate(now) / deadline / taxRate / createdBy(現ユーザ) / departmentId。
- クリア: **unitPrice=0** / itemDiscount / overallDiscount / status(全 ACTIVE) / 申請レコード(作らない)。
- 価格クリア範囲の根拠: 固定額値引は単価0で負数ガード（`LineItemAmountPolicy` / `EstimateAmountPolicy`）に抵触するため必須クリア。率は負にならず後の単価入力時に効くため継承。
- 順序: 選択順を保持し variationNumber を 1,2,3… で連番振り直し。
- 将来拡張: 販売単価テーブル確定後、複製時に単価を前埋め（別 issue・ポート経由）。

## ステップ

### Step 0: 系譜表の自然キー化（ADR-0041）
- 対象ファイル: `prisma/schema.prisma`、マイグレーション
- 作業内容:
  - `EstimateVariationCopy` の `id` 列を削除し `copiedVariationId` を `@id` に（`createdAt/updatedAt` は維持）
  - `pnpm db:migrate` でマイグレーション生成 → `pnpm db:generate`
- コミットメッセージ: `refactor(schema): 見積複製系譜表を自然キー(copiedVariationId)化（ADR-0041）`

### Step 1: 系譜の値オブジェクト
- 対象ファイル: `src/server/subdomains/estimate/domain/values/EstimateVariationCopy.ts`、`__tests__/EstimateVariationCopy.test.ts`
- 作業内容:
  - `{ copiedVariationId: EstimateVariationId, sourceVariationId: EstimateVariationId }` の不変 VO（独自 id 無し / ADR-0041）
- コミットメッセージ: `feat(domain): 見積複製系譜の値オブジェクト EstimateVariationCopy を追加`

### Step 2: EstimateFactory.duplicate（子構築＋系譜ペア化）
- 対象ファイル: `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts`、`__tests__/EstimateFactory.test.ts`
- 作業内容:
  - `CopiedVariationDescriptor = EstimateVariationDescriptor & { sourceVariationId }`
  - `static duplicate(input): { estimate, copies }` … `buildVariation` で新 id 生成し、その場で `EstimateVariationCopy` をペア化。修理/事後詳細も記述子から構築
- コミットメッセージ: `feat(domain): EstimateFactory.duplicate で複製集約と系譜を生成する`

### Step 3: EstimateDuplicationService（複製の業務判断）
- 対象ファイル: `src/server/subdomains/estimate/domain/services/EstimateDuplicationService.ts`、`__tests__/EstimateDuplicationService.test.ts`
- 作業内容:
  - 入力 `{ source, selectedVariationIds, estimateNumber, estimateDate, deadline, taxRate, createdBy, departmentId }` → `{ estimate, copies }`
  - ≥1 検証（ADR-0042）、選択 id 順に source 変奏を解決（未存在は例外）
  - 記述子化（単価0・固定値引クリア・率継承・連番・items/メモ複写）、継承項目読み取り（修理詳細ディープコピー含む）、`EstimateFactory.duplicate` 呼び出し
- コミットメッセージ: `feat(domain): 見積複製ドメインサービス EstimateDuplicationService を追加`

### Step 4: リポジトリ insertWithCopies（ADR-0040）
- 対象ファイル: `domain/repositories/EstimateRepository.ts`、`infrastructure/mappers/EstimateMapper.ts`、`infrastructure/prisma/PrismaEstimateRepository.ts`、`__tests__/PrismaEstimateRepository.test.ts`
- 作業内容:
  - インターフェースに `insertWithCopies(estimate, copies)` 追加
  - Mapper に `toVariationCopyCreateManyInput`
  - `$transaction` で `estimate.create` → `estimateVariationCopy.createMany`。採番衝突翻訳を既存 insert と共通化
- コミットメッセージ: `feat(infra): EstimateRepository.insertWithCopies で新見積と複製系譜をアトミック保存する`

### Step 5: アプリ層 DuplicateEstimateCommand＋ファクトリ
- 対象ファイル: `application/commands/DuplicateEstimateCommand.ts`、`application/factories/duplicateEstimateCommandFactory.ts`、`factories/index.ts`、`commands/__tests__/DuplicateEstimateCommand.test.ts`
- 作業内容:
  - `findById(source)`（null は NotFound 相当で throw）→ `source.estimateType` で採番 → VO 変換 → `EstimateDuplicationService.duplicate` → `insertWithCopies`
  - 入力 = `{ sourceEstimateId, selectedVariationIds[], estimateDate, deadline, taxRate, createdBy, departmentId }`
- コミットメッセージ: `feat(app): C6 DuplicateEstimateCommand とファクトリを実装する`

### Step 6: ドキュメント整合・仕上げ
- 対象ファイル: `docs/business/estimate/システム設計書(見積).md`（§5.2 注記）
- 作業内容:
  - §5.2 に「選択なし可は C6 責務外（ADR-0042）」を注記
  - `pnpm test` / `pnpm lint` 全通過確認
- コミットメッセージ: `docs: §5.2 注記（複製は≥1要求・ADR-0042反映）`

## スコープ外

プレゼン層／複製プレビュー UI／読み取り側の複製元表示（QueryService）／販売単価テーブル前埋め／C7 改訂・C5・Order 系（C8-C11）・TaxRate（C12）・クエリ。
