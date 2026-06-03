# Issue #293: feat: アプリ層コマンド C1 CreateEstimate を実装する（着手順序 #6・最小縦スライス） — 実装計画

## Context

多階層集約 Estimate（`EstimateItem → EstimateVariation → Estimate`）はエンティティ・採番VO・金額計算ポリシー・Repository インターフェース・Prisma 実装まで先行実装済み。本 issue はそれらを統合する**初のアプリケーション層スライス C1 `CreateEstimate`** を実装し、「Command + factory(DI) + 単体テスト」のパターンを確定させて後続コマンド（C2-C4）へ横展開する土台を作る。

調査の結果、Issue が「満たすべき不変条件」に挙げる横断ポリシーのうち、依存 collaborator の実装状況に差があることが判明した。ユーザー確認により以下のとおり方針確定済み:

| 横断ポリシー | 方針（確定） |
|---|---|
| 保存時採番（§2.3） | **採番ポート `EstimateNumberIssuer` を新設しDI**。連番は **MAX(sequence)+1**（専用テーブルは作らない）。一意性は `estimateNumber @unique` が担保し、稀な並行衝突は**手動リトライ**（ユーザーに再登録を促す）で対応 |
| 作成時税率自動設定（§A.1） | **Input で `taxRate` を受け取る**（見積作成画面から渡す。税率取得ポート化は後続） |
| 部署自動設定（§A.1） | **Input で `departmentId` を受け取る**（見積画面から渡す。Employee 参照での自動解決は後続） |
| 税率チェック（§8.6/§8.7） | **スコープ外**（後続 issue） |
| estimateType と修理サブタイプ整合（ADR-0019） | `Estimate.create()` が既に担保（追加実装不要） |
| 空見積不可 | `Estimate.create()` が既に担保（バリエーション0件で `BusinessRuleViolationError`） |
| 金額計算（§8） | `EstimateVariation.create()`/`EstimateItem.create()` が生成時に既存ポリシーで算出（追加実装不要） |

## 設計判断

### 採番方式: MAX+1（専用カウンタテーブルは作らない）
- A. MAX(sequence)+1 を採番し、一意性は `estimateNumber @unique` で担保。衝突は手動リトライ（**採用**）
- B. 専用カウンタテーブル `EstimateNumberSequence` を新設し原子的にインクリメント
- 採用理由:
  - DB の一意性は `estimateNumber @unique`（= `(estimateType, fiscalYear, sequence)` 相当）が常に保証するため、どの方式でもデータ破損は起きない
  - 見積は**物理削除を想定しない運用方針**（`delete()` はインターフェース/実装に存在するがアプリ層から未使用・論理削除列なし）。物理削除が無ければ `MAX(sequence)` は単調増加し連番の再利用は起こり得ないため、MAX+1 は §2.2「削除番号を再利用しない」を実運用上そのまま満たす
  - 既存テスト/シードは `EstimateNumber` を issuer を通さず直接生成しており、MAX+1 は常に実在行を参照するため不整合が起きない（専用カウンタは別ソースとの同期問題を抱える）
  - 年間〜1,000件規模で同一(年度・区分)・同時刻の並行作成は極めて稀。マイグレーション不要で issue スコープに収まる
  - 将来 §2.2 の厳密準拠が必要になったら、ポート実装（`PrismaEstimateNumberIssuer`）を差し替えるだけでよく、**コマンド側は無変更**（`EstimateNumberIssuer` interface で DI するため）

### 採番ポート interface の配置先
- A. `domain/repositories/` に配置（`EstimateRepository` と同居・**採用**）
- B. `domain/ports/` を新設
- 採用理由: 永続化バックエンドを伴う契約であり、既存の `repositories/` 配置と一貫。新ディレクトリ概念を増やさない。

### 連番衝突（P2002）のハンドリング配置
- 保存時の `estimate_number` unique 違反（Prisma `P2002`）を **infrastructure 層（`PrismaEstimateRepository.save`）で捕捉**し、新設の `ConflictError`（application 層）に変換して throw する
- 理由: Prisma 固有のエラーコード知識を application/presentation に漏らさない（DDD レイヤリング遵守）。プレゼン層は `ConflictError` を「登録エラー、もう一度登録してください」に対応付ける
- コマンド内での自動リトライは行わない（ユーザー確認方針: 手動リトライ）

### 採番のタイミングと欠番
- command は `create()` 前に採番ポートを呼び、その後 `repository.save()` を実行する
- save 失敗時に採番済み連番が欠番として残るが **§2.2 が欠番を明示的に許容**するため許容（集約の「番号必須」契約を保てる）

### EstimateNumber の組み立て箇所
- `EstimateNumber` VO は公開ファクトリを `parse(text)` のみに限定する既存設計を維持する
- 採番ポート実装側で 8桁文字列（`接頭辞 + 年度2桁 + 連番5桁ゼロ詰め`）を組み立てて `EstimateNumber.parse()` する

### Input の値受け取り単位
- 既存 Command 規約（customer/product）踏襲: Input はプリミティブ型で受け取り、command 内で値オブジェクトへ変換。判断不要。

## ステップ

> 補足: 本計画ファイルは `docs/claude-plans/issue-293/` 配下に配置済み。

### Step 1: 採番ポート EstimateNumberIssuer インターフェースを定義する
- 対象ファイル: `src/server/subdomains/estimate/domain/repositories/EstimateNumberIssuer.ts`（新規）
- 作業内容:
  - `export interface EstimateNumberIssuer { issueNext(fiscalYear: FiscalYear, estimateType: EstimateType): Promise<EstimateNumber>; }`
  - ドメイン層のみに依存（Prisma 非依存）
- コミットメッセージ: `feat: 採番ポート EstimateNumberIssuer インターフェースを定義する`
  - body に「ポートを domain/repositories に配置した理由（EstimateRepository と同列の永続化契約）」を記載

### Step 2: 採番ポートの Prisma 実装 PrismaEstimateNumberIssuer を実装する
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer.ts`（新規）
  - `src/server/subdomains/estimate/infrastructure/prisma/__tests__/PrismaEstimateNumberIssuer.test.ts`（新規）
- 作業内容:
  - `estimate` テーブルを `(fiscalYear, estimateType)` で絞り `MAX(sequence)` を取得（既存索引 `@@index([fiscalYear, estimateType, sequence])` を活用）。行が無ければ連番 1、あれば `max+1`
  - `seq > EstimateNumber.SEQUENCE_MAX(99999)` で上限超過エラー
  - `接頭辞(estimateType.prefix) + fiscalYear.toShortString() + String(seq).padStart(5,"0")` を `EstimateNumber.parse()` で返す
  - テスト: 行が無い (年度,区分) では連番1 / 既存行があれば max+1 / (年度,区分) ごとに独立 / 上限超過でエラー（テスト専用の年度帯=2099 等で実データと衝突回避、`ensureEstimateFixtures()` で FK 用意）
- コミットメッセージ: `feat: 採番ポートの Prisma 実装 PrismaEstimateNumberIssuer を実装する`
  - body に「専用テーブルではなく MAX+1 を採用した理由」を記載

### Step 3: ConflictError を新設し、採番衝突(P2002)を変換する
- 対象ファイル:
  - `src/server/shared/errors/ApplicationError.ts`（`ConflictError extends ApplicationError` を追加）
  - `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository.ts`（save の新規作成パスで `estimate_number` の `P2002` を捕捉し `ConflictError` へ変換）
  - 既存テスト（`PrismaEstimateRepository.test.ts`）に衝突→`ConflictError` ケースを1件追加
- 作業内容:
  - `Prisma.PrismaClientKnownRequestError` かつ `code === "P2002"` かつ対象が `estimate_number` の場合のみ `ConflictError`（メッセージ例「見積番号の採番が競合しました。もう一度登録してください。」）を throw。それ以外は再 throw
- コミットメッセージ: `feat: 採番衝突を ConflictError として表面化する`
  - body に「Prisma 固有エラーを infrastructure 層で変換し application/presentation に漏らさない理由」を記載

### Step 4: CreateEstimateCommand と Input 型を実装する
- 対象ファイル: `src/server/subdomains/estimate/application/commands/CreateEstimateCommand.ts`（新規）
- 作業内容:
  - `CreateEstimateInput`（ヘッダ + `variations[]`（最低1）+ 各 `items[]` + 排他的 `repairDetail?`/`afterRepairDetail?`）をプリミティブ型で定義
  - `taxRate`・`departmentId`・`createdBy(employeeId)` は Input から受け取る
  - 依存注入: `constructor(private estimateRepository: EstimateRepository, private numberIssuer: EstimateNumberIssuer)`
  - `execute(input): Promise<Estimate>` の流れ:
    1. プリミティブ → 値オブジェクト変換（`EstimateType`/`SubmissionType`/`TaxRoundingType`/`Money`/`Quantity` 等。VO 生成は `estimateAggregateBuilder.ts` の生成規約を参照）
    2. `EstimateItem.create()` → `EstimateVariation.create()` で子集約を構築
    3. `repairDetail`/`afterRepairDetail` を `estimateType` に応じて構築
    4. `fiscalYear = FiscalYear.from(input.estimateDate)`（既存 `FiscalYear.from`・JST/4月始まり）
    5. `estimateNumber = await this.numberIssuer.issueNext(fiscalYear, estimateType)`
    6. `Estimate.create({...})`（空見積不可・サブタイプ整合・variationNumber 重複を集約が担保）
    7. `return await this.estimateRepository.save(estimate)`（衝突時は `ConflictError` が bubble）
- コミットメッセージ: `feat: アプリ層コマンド CreateEstimate を実装する`
  - body に「税率・部署を自動設定ではなく Input 受け取りにした理由」「採番を save 前に行う設計と欠番許容（§2.2）」を記載

### Step 5: createEstimateCommandFactory を実装する
- 対象ファイル:
  - `src/server/subdomains/estimate/application/factories/createEstimateCommandFactory.ts`（新規）
  - `src/server/subdomains/estimate/application/factories/index.ts`（新規）
- 作業内容:
  - 既存 factory パターン（customer/product/employee）に倣い Composition Root として `PrismaEstimateRepository` と `PrismaEstimateNumberIssuer` を解決して `CreateEstimateCommand` を返す
  - `index.ts` で再エクスポート
- コミットメッセージ: `feat: createEstimateCommandFactory を実装する`

### Step 6: CreateEstimateCommand の単体テストを追加する
- 対象ファイル: `src/server/subdomains/estimate/application/commands/__tests__/CreateEstimateCommand.test.ts`（新規）
- 作業内容:
  - 既存 Command テスト規約（vitest・実 Prisma・beforeEach/afterEach クリーンアップ・日本語 describe）に準拠
  - FK 前提データは既存ヘルパー `ensureEstimateFixtures()`（`@server/__tests__/helpers/ensureEstimateFixtures`）を再利用（`customerId/deliveryLocationId/employeeId/departmentId/productId`）
  - テスト専用の年度帯（例 2099）で実データと衝突しない見積番号帯を使用し、`afterEach` で該当 `estimate` を該当キーのみクリーンアップ
  - テストケース:
    - NEW・バリエーション1件・明細ありで作成でき、採番された `estimateNumber`/`fiscalYear`/`sequence`（連番1）と金額集計が永続化される（最小縦スライスの happy path）
    - 連続作成で連番が +1 される（保存時採番 §2.3・MAX+1）
    - REPAIR/AFTER_REPAIR で対応サブタイプ詳細が保存される / 不整合は `Estimate.create` がエラー（ADR-0019）
    - バリエーション0件は `BusinessRuleViolationError`（空見積不可）
- コミットメッセージ: `test: CreateEstimateCommand の単体テストを追加する`

## スコープ外（再掲）
- C2 以降のコマンド / クエリ（Q1-Q8） / 申請・受注連携 / プレゼンテーション層
- 税率チェック（§8.6/§8.7） / 税率取得ポート / 部署自動解決ポート

## Verification
- `pnpm test`（少なくとも `PrismaEstimateNumberIssuer.test.ts` と `CreateEstimateCommand.test.ts`）が通過
- `pnpm lint` 通過
- マイグレーション不要（スキーマ変更なし）
- DDD レイヤリング検証: application は `EstimateRepository`/`EstimateNumberIssuer`（domain interface）にのみ依存し Prisma 直接依存なし。集約ルート `Estimate` 経由でのみ構築・永続化。Prisma `P2002` は infrastructure で `ConflictError` に変換
- 作業完了時、計画との逸脱があれば `docs/claude-plans/issue-293/deviations.md` に記録
