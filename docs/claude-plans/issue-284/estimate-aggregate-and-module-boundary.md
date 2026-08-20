# Issue #284: 見積エンティティ/集約（EstimateItem → EstimateVariation → Estimate）を実装する — 実装計画

## Context

着手順序 #4。値オブジェクト（#281 金額計算、#283 `EstimateNumber`）が整ったので、見積サブドメインの集約 `Estimate → EstimateVariation → EstimateItem` を実装する。

設計書（`docs/business/estimate/システム設計書(見積).md` §11）と実装済み Prisma スキーマ（`prisma/schema.prisma:441-805`）は読み込み済みで、本イシューはそれを Domain 層に写像する作業。Issue 本文の「設計は別ブランチで先行」は当初想定だが、ユーザー判断によりシステム設計書を一次ソースとして本イシュー内で具体実装まで進める。

本イシューは Estimate 集約の実装に加え、プロジェクト初の本格 DDD 集約として「**Domain 層モジュール境界規約の確立**」も担う。リポジトリ interface・Prisma マッパー・アプリ層は別イシュー（着手順序 #5, #6）。

## 設計判断

### 1. サブタイプ詳細 3 表を本イシューに含める

- **採用**: `RepairEstimateDetail` / `AfterRepairEstimateDetail` / `RevisedEstimateItemDetail` を子エンティティとして本イシュー内に実装。
- **理由**: ADR-0019「`estimateType` と詳細テーブルの整合性は Domain 層で担保」を有効にするには、サブタイプが集約内に存在する必要がある。`Estimate` 単体だけ作っても排他的サブタイプ不変条件を表現できない。

### 2. 集約への状態変更 API を集約ルート経由に統一（モジュール境界で構造的に強制）

- **採用**: バレル `src/server/subdomains/estimate/domain/entities/index.ts` から `Estimate` のみ export。子エンティティ（`EstimateVariation` / `EstimateItem` / 修理・改訂詳細）は **export しない**。集約外コードは子エンティティを import すること自体が不可能になる。
- **子エンティティのメソッド**: 子の状態変更メソッドは **public** で OK（外から import できないため呼べない）。`_` プレフィクスは使わない。
- **ESLint で深い import を禁止**: `no-restricted-imports` パターンで `@subdomains/estimate/domain/entities/EstimateVariation` 等の直接パス指定を拒否し、`@subdomains/estimate/domain/entities` バレル経由のみ許可する。同ディレクトリ内の相対 import（`./EstimateVariation`）は許可するパターンで設定する。
- **子を外に返さない**: `estimate.getVariations()` で子配列をそのまま返すと外部からメソッドを叩けるため、**集約ルートが必要な操作を全て提供する**（getter で渡すなら DTO に変換、または `ReadonlyArray<Readonly<T>>` で型エラーに頼る）。
- **理由**:
  - §3.4「1見積につき申請できるバリエーションは1つのみ」は集約横断の不変条件。
  - §4.8「受注作成後は編集不可」のような集約全体に効くロックを子操作の入口で一元チェックできる。
  - 自動再計算（下記 3）の伝播を集約内部で完結させられる。
  - 規約レベルではなく「構造的に守る」ことで、将来の実装者が誤って境界を越える事故を ESLint が CI で検出する。
- **将来サブドメインへの波及**: 同パターンを `order` / `tax-rate` 集約にも適用する想定。本イシューがその先例となる。

### 3. 金額再計算は明細変更のつど自動実行（集約内不変条件）

- **採用**: `EstimateItem` の状態変更後に `EstimateVariation` の集計（`subtotal` / `discountSubtotal` / `finalSubtotal` / `taxAmount` / `finalTotal`）を自動更新する。Variation 単独の値引・税率変更も同様。
- **理由**: §8.6 が「保存時・申請時に再計算」と書く以上、Domain 層では常に最新を保つのが最も安全。`recalculate()` の呼び忘れを構造的に防ぐ。
- **計算委譲先**: 既存の `LineItemAmountPolicy` / `EstimateAmountPolicy`（`src/server/subdomains/estimate/domain/policies/`）を再利用。エンティティはポリシーに値を渡すだけ。

### 4. 修理関連テキストは値オブジェクト化

- **採用**: `FaultDescription`（故障内容・2000 文字）と `EmergencyReason`（緊急対応理由・2000 文字）を VO 化。
- **理由**: 既存サブドメイン（Employee, Customer 等）のテキスト系列はすべて VO 化されており、規約として一貫している。

### 5. 集約またぎ参照は ID のみ保持

- `Estimate` の `customerId` / `deliveryLocationId` / `createdBy` / `departmentId` は ID 値オブジェクトのみ持つ（他集約のエンティティ参照はしない）。Vernon「Effective Aggregate Design」Rule 4 に従う。

### 6. リポジトリ層からの子エンティティ復元

- 着手順序 #5（別イシュー）で `PrismaEstimateRepository.toDomain()` が子エンティティを再構築する必要がある。バレル経由のみ export だと `EstimateItem.reconstruct()` が呼べなくなる。
- **方針**: 本イシューでは「entities バレルは Estimate のみ export」を確立し、リポジトリ実装時に必要に応じて「reconstruct 専用 export 経路（例: `entities/internal.ts`）」を切る方針を **別イシューで決定**。本イシュー時点では `entities/index.ts` から `Estimate` のみ export とする。

## ステップ

### Step 1: ID 値オブジェクト 3 つ
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/EstimateId.ts`
  - `src/server/subdomains/estimate/domain/values/EstimateVariationId.ts`
  - `src/server/subdomains/estimate/domain/values/EstimateItemId.ts`
  - 各 `__tests__/{Name}.test.ts`
- 作業内容:
  - 既存 `CustomerId` / `EmployeeId` パターンを踏襲（UUIDv7 生成 + `generate()` / `restore()`）
  - `generateId.ts` を使用
- コミットメッセージ: `feat: 見積関連 ID 値オブジェクトを追加する`

### Step 2: VariationStatus 値オブジェクト
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/VariationStatus.ts`
  - `__tests__/VariationStatus.test.ts`
- 作業内容:
  - `ACTIVE` / `INACTIVE` の 2 値 VO
  - `isActive()` / `activate()` / `deactivate()` 等の判定/遷移ヘルパ
  - Prisma `enum VariationStatus` と文字列で 1:1 対応
- コミットメッセージ: `feat: VariationStatus 値オブジェクトを追加する`

### Step 3: SubmissionType 値オブジェクト
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/SubmissionType.ts`
  - `__tests__/SubmissionType.test.ts`
- 作業内容:
  - `CUSTOMER` / `DELIVERY_LOCATION` 2 値 VO
  - `isCustomer()` / `isDeliveryLocation()` 判定（§7.2「納品先見積は申請・受注作成不可」で使う）
- コミットメッセージ: `feat: SubmissionType 値オブジェクトを追加する`

### Step 4: 修理関連テキスト VO（FaultDescription / EmergencyReason）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/FaultDescription.ts`
  - `src/server/subdomains/estimate/domain/values/EmergencyReason.ts`
  - 各 `__tests__/{Name}.test.ts`
- 作業内容:
  - VarChar(2000) 制約に対応した文字列 VO
  - 空文字禁止・前後空白トリム・最大長検証
- コミットメッセージ: `feat: 修理関連テキスト値オブジェクト（FaultDescription, EmergencyReason）を追加する`

### Step 5: RevisedEstimateItemDetail 子エンティティ
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/RevisedEstimateItemDetail.ts`
  - `__tests__/RevisedEstimateItemDetail.test.ts`
- 作業内容:
  - `deliveryPrice: Money` のみを保持（§11.3.1）
  - public メソッド `changeDeliveryPrice()` で更新（バレルで export しないため外から呼べない）
  - 独自 ID と createdAt/updatedAt 管理
- コミットメッセージ: `feat: RevisedEstimateItemDetail 子エンティティを追加する`

### Step 6: EstimateItem エンティティ（自動再計算込み）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateItem.ts`
  - `__tests__/EstimateItem.test.ts`
- 作業内容:
  - フィールド: `id`, `productId`, `sortOrder`, `itemName`, `quantity`, `unit`, `unitPrice`, `discountRate`, `itemDiscount`, `customerMemo?`, `internalMemo?`, `revisedDetail?`, 計算結果 3 つ
  - `create()` 内で `LineItemAmountPolicy.calculate()` を呼び `baseAmount` / `discountedAmount` / `finalAmount` を確定
  - `changeQuantity()` / `changeUnitPrice()` / `changeDiscountRate()` / `changeItemDiscount()` 等は呼ばれるたび自動再計算
  - `attachRevisedDetail()` / `detachRevisedDetail()` で改訂明細を切り替え
- コミットメッセージ: `feat: EstimateItem エンティティを追加する（自動再計算込み）`

### Step 7: RepairEstimateDetail 子エンティティ
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/RepairEstimateDetail.ts`
  - `__tests__/RepairEstimateDetail.test.ts`
- 作業内容:
  - `targetProductId: ProductId`, `faultDescription: FaultDescription`, `scheduledRepairDate: Date`
  - 各 `changeXxx()` ミューテータ（public、バレル外）
- コミットメッセージ: `feat: RepairEstimateDetail 子エンティティを追加する`

### Step 8: AfterRepairEstimateDetail 子エンティティ
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/AfterRepairEstimateDetail.ts`
  - `__tests__/AfterRepairEstimateDetail.test.ts`
- 作業内容:
  - `targetProductId`, `faultDescription`, `actualRepairDate`, `emergencyReason`, `afterServiceWarningAcknowledged`
  - `acknowledgeWarning()` 遷移メソッド（§6.3 10万円超警告の確認）
- コミットメッセージ: `feat: AfterRepairEstimateDetail 子エンティティを追加する`

### Step 9: EstimateVariation エンティティ（集計自動再計算 + 明細管理）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`
  - `__tests__/EstimateVariation.test.ts`
- 作業内容:
  - フィールド: `id`, `variationNumber`, `status`, `customerMemo?`, `internalMemo?`, `overallDiscount`, `items: EstimateItem[]`, 集計 5 つ
  - `addItem()` / `removeItem()` / `updateItem()` ですべて `EstimateAmountPolicy.calculate()` を再実行（自動再計算）
  - `changeOverallDiscount()` で再計算
  - `activate()` / `deactivate()` 状態遷移（§3.4 制約は集約ルート側で前段チェック）
  - `taxRate` / `taxRoundingType` は計算時に親 Estimate から渡される（自分では保持しない）
- コミットメッセージ: `feat: EstimateVariation エンティティを追加する（集計自動再計算込み）`

### Step 10: Estimate 集約ルート
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/Estimate.ts`
  - `__tests__/Estimate.test.ts`
- 作業内容:
  - フィールド: `id`, `estimateNumber`, `estimateType`, `fiscalYear`, `sequence`, `estimateDate`, `deadline`, `submissionType`, `customerId`, `deliveryLocationId`, `taxRate`, `taxRoundingType`, `createdBy`, `departmentId`, `variations: EstimateVariation[]`, `repairDetail?`, `afterRepairDetail?`
  - `create()`: ヘッダ + 最低 1 バリエーション + 明細を同時受け取り（§C1 不変条件 = 空見積不可）
  - 集約ルート API（**集約外から見える唯一の操作面**）:
    - `addVariation()` / `deactivateVariation(id)` / `activateVariation(id)` — §3.4 制約チェック含む
    - `addItem(variationId, ...)` / `removeItem(variationId, itemId)` / `updateItem(variationId, itemId, patch)` — 子の public メソッドを呼ぶ
    - `changeOverallDiscount(variationId, ...)` / `changeTaxRoundingType(...)` 等
    - `attachRepairDetail()` / `attachAfterRepairDetail()` — estimateType との排他的整合チェック（ADR-0019）
  - getter で子を返す必要がある場合は `ReadonlyArray<Readonly<T>>` または DTO に変換
  - 集約全体の不変条件:
    - estimateType と詳細テーブルの整合（NEW なら詳細なし、REPAIR なら repairDetail 必須、AFTER_REPAIR なら afterRepairDetail 必須）
    - 全バリエーションで集計が再計算済み（自動）
    - variationNumber の重複・連番性
- コミットメッセージ: `feat: Estimate 集約ルートを追加する（§3.4 / ADR-0019 不変条件込み）`

### Step 11: モジュール境界の構造化（バレル + ESLint）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/index.ts`（新規バレル）
  - `eslint.config.mjs`（既存に `no-restricted-imports` ルール追加）
- 作業内容:
  - バレルから `Estimate` のみ export（子エンティティは export しない）
  - ESLint `no-restricted-imports` パターン:
    - 禁止: `@subdomains/estimate/domain/entities/EstimateVariation`, `EstimateItem`, `RepairEstimateDetail`, `AfterRepairEstimateDetail`, `RevisedEstimateItemDetail` への外部からの直接 import
    - 許可: 同 entities ディレクトリ内の相対 import（`./EstimateVariation` 等）と `@subdomains/estimate/domain/entities` バレル経由
  - 既存テスト（Step 5-10 で書いた `__tests__/`）がパスすることを確認（同ディレクトリ内なので相対 import で問題ない）
- 検証:
  - `pnpm lint` がパス
  - 試しに別サブドメインから `import { EstimateItem } from "@subdomains/estimate/domain/entities/EstimateItem"` を書いて ESLint エラーになることを目視確認（その後削除）
- コミットメッセージ: `chore: 見積集約のモジュール境界を構造化する（バレル + ESLint）`

## 既存資産の参照

- 値オブジェクト基底: `src/server/shared/ValueObject.ts`
- エラー階層: `src/server/shared/errors/DomainError.ts`（`ValidationError` / `BusinessRuleViolationError`）
- 既存エンティティ参考: `src/server/subdomains/customer/domain/entities/Customer.ts`
- 既存集約金額ポリシー: `src/server/subdomains/estimate/domain/policies/{LineItemAmountPolicy,EstimateAmountPolicy}.ts`
- ID 生成: `src/server/shared/generateId.ts`
- 他サブドメイン ID（`CustomerId`, `DeliveryLocationId`, `EmployeeId`, `DepartmentId`, `ProductId`）は既存のものを import

## スコープ外（別イシュー）

- `EstimateRepository` interface（着手順序 #5）
- Prisma マッパー・`PrismaEstimateRepository`（着手順序 #5 後段）
  - その際、子エンティティの `reconstruct()` を呼ぶための export 経路（例: `entities/internal.ts`）の設計判断が必要
- アプリ層ユースケース C1〜C12（着手順序 #6）
- 横断ポリシー（採番 sequence 払い出し、税率チェック、PermissionService）

## 検証

```bash
# Domain 層の全テストが通る
pnpm test src/server/subdomains/estimate/domain/

# 型チェック・Lint
pnpm lint

# DDD レイヤリング規約: Domain 層が外部ライブラリに依存していないか
grep -r "from 'next\|from \"next\|from '@prisma\|from \"@prisma" src/server/subdomains/estimate/domain/ || echo "OK: 外部依存なし"

# モジュール境界規約: 集約外から子エンティティが import 不可
# 試行用に一時的に別サブドメインに違反コードを書いて pnpm lint がエラーを出すことを目視確認
```

各 Step のテストでは:
- VO: 受け入れ値 / 拒否値 / 等価判定
- エンティティ: 生成 / 状態遷移 / 不変条件違反時の例外
- 集約: 子操作の伝播・自動再計算・集約横断不変条件（§3.4, §4.8, ADR-0019）の網羅
