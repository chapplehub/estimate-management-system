# Issue #272: 見積コア Prisma スキーマ追加（見積本体＋サブタイプ＋税率マスタ） — 実装計画

## 概要

`docs/business/estimate/システム設計書(見積).md` §11 の概念設計を Prisma スキーマとして実装する。本 issue では「見積本体＋サブタイプ＋税率マスタ」の **7 モデル**に絞り、Order 系・系譜（複製/改訂）・共通申請テーブル（ADR-0001）は別 issue で段階的に追加する。

対象モデル:

1. `TaxRate` (§11.5) — 消費税率マスタ
2. `Estimate` (§11.1) — 見積本体
3. `RepairEstimateDetail` (§11.1.1) — 修理見積サブタイプ
4. `AfterRepairEstimateDetail` (§11.1.1) — 事後修理サブタイプ
5. `EstimateVariation` (§11.2) — バリエーション
6. `EstimateItem` (§11.3) — 明細
7. `RevisedEstimateItemDetail` (§11.3.1) — 改訂明細サブタイプ

スコープ外（別 issue）: `EstimateVariationCopy` / `EstimateVariationRevision` / `Order` / `OrderConfirmation` / `OrderCancellation` / 共通申請テーブル。

## 設計判断

### メモ系の型: 設計書 `@db.Text` → 実装 `@db.VarChar(2000)`
- A. 設計書通り `@db.Text` を採用
- B. **`@db.VarChar(2000)` で統一**（ユーザー確定）
- 推奨: **B**。ADR-0019「全 String カラムに上限を持たせる」と整合。設計書 §11 冒頭「実装規約が別途優先」注記の範疇。対象: `customerMemo` / `internalMemo` / `faultDescription` / `emergencyReason`

### `Estimate.createdBy` の参照先: `User` → `Employee`
- A. 設計書通り `User` を参照
- B. **`Employee` を参照**
- 推奨: **B**。既存マスタの参照規約（業務エンティティは `Employee.id` を参照）に整合。§9 の部署権限チェックで `Employee.departmentId` が必要。`User` は better-auth 用テーブルで業務エンティティから直接参照しない（`Employee` ↔ `User` の 1:1 経由で必要時に解決）

### 税率／掛率の Decimal 精度
- 税率 `taxRate`: **`@db.Decimal(4, 3)`**（0.000〜0.999、例: 0.100）
- 掛率 `discountRate`: **`@db.Decimal(5, 4)`**（0.0000〜1.0000、デフォルト 1.0000 を含めるため整数部 1 桁が必要）
- 金額系: **`@db.Decimal(12, 2)`**（既存 `Product.costPrice` と整合）

### CHECK 制約の上限値（業務意味で表現）
- `tax_rate >= 0 AND tax_rate < 1` — 税率は元金額未満（業務制度上 100% 以上は想定外）
- `discount_rate >= 0 AND discount_rate <= 1` — 掛率は 0〜1。デフォルト 1.0 を有効にするため `<=` を採用
- Decimal 精度の上限（例: 9.9999）をそのまま CHECK 上限にしない（業務的意味と乖離するため）

### マイグレーション分割: 論理単位で 3 つに分割
- A. 1 マイグレーションで一括作成
- B. **論理単位で 3 マイグレーション**
- 推奨: **B**。CLAUDE.md「Commit at each meaningful change」と整合。Phase 順序は依存関係で固定（Phase 1 独立 → Phase 2 → Phase 3）

### スコープ外モデルへの逆リレーションを今回は書かない
- `Estimate.orders` / `EstimateVariation.copies` / `EstimateVariation.revisions` / `EstimateVariation.order` 等は今回追加しない
- 理由: Order / 系譜モデル本体が未実装のため Prisma クライアント生成が失敗する。別 issue で本体モデル追加時に同 PR で逆リレーションも追加する方が安全

## ステップ

### Step 1: 計画ファイルをコミット
- 対象ファイル: `docs/claude-plans/issue-272/plan.md`
- 作業内容:
  - 本ファイルを作成
- コミットメッセージ: `docs: Issue #272 の実装計画を追加`

### Step 2: Phase 1 — TaxRate モデル + マイグレーション + シード
- 対象ファイル:
  - `prisma/schema.prisma`
  - `prisma/seed.ts`
  - `prisma/migrations/<timestamp>_add_tax_rate_master/migration.sql`
- 作業内容:
  - schema.prisma 末尾に「消費税率関連」セクションを追加し `TaxRate` モデルを定義
  - `pnpm db:migrate` で `add_tax_rate_master` マイグレーション生成
  - 生成された migration.sql に CHECK 制約 `rate >= 0 AND rate < 1` を手書き追記
  - `pnpm prisma migrate reset` で drift 解消
  - seed.ts に税率 2 件（2014/4 から 0.080、2019/10 から 0.100）を JST で投入
  - `pnpm prisma db seed` で投入確認、`pnpm prisma studio` で 2 行存在確認
  - 税率取得クエリ（`findFirst({ where: { effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: 'desc' } })`）が `0.100` を返すこと確認
- コミットメッセージ: `feat: 消費税率マスタ (TaxRate) を追加`

### Step 3: Phase 2 — Estimate + 修理サブタイプ
- 対象ファイル:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_add_estimate_with_repair_subtypes/migration.sql`
- 作業内容:
  - 3 つの enum（`EstimateType`, `SubmissionType`, `TaxRoundingType`）を追加
  - `Estimate` / `RepairEstimateDetail` / `AfterRepairEstimateDetail` モデルを追加
  - 既存マスタに逆リレーション追加:
    - `Customer.estimates Estimate[] @relation("CustomerEstimates")`
    - `DeliveryLocation.estimates Estimate[] @relation("DeliveryLocationEstimates")`
    - `Department.estimates Estimate[] @relation("EstimateDepartment")`
    - `Employee.createdEstimates Estimate[] @relation("EstimateCreator")`
    - `Product.repairTargetDetails RepairEstimateDetail[] @relation("RepairTargetProduct")`
    - `Product.afterRepairTargetDetails AfterRepairEstimateDetail[] @relation("AfterRepairTargetProduct")`
  - `pnpm db:migrate` で `add_estimate_with_repair_subtypes` マイグレーション生成
  - 生成された migration.sql に CHECK 制約手書き追記:
    - `fiscal_year >= 2000 AND fiscal_year <= 9999`
    - `sequence >= 1 AND sequence <= 99999`
    - `tax_rate >= 0 AND tax_rate < 1`
  - `pnpm prisma migrate reset` で drift 解消
  - `pnpm build` / `pnpm test` / `pnpm lint` で既存機能が壊れていないか確認
- コミットメッセージ: `feat: 見積本体 (Estimate) と修理サブタイプ (Repair/AfterRepairEstimateDetail) を追加`

### Step 4: Phase 3 — EstimateVariation + EstimateItem + RevisedEstimateItemDetail
- 対象ファイル:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_add_estimate_variation_items/migration.sql`
- 作業内容:
  - `VariationStatus` enum を追加
  - `EstimateVariation` / `EstimateItem` / `RevisedEstimateItemDetail` モデルを追加
  - 既存マスタに逆リレーション追加:
    - `Product.estimateItems EstimateItem[] @relation("EstimateItemProduct")`
  - `pnpm db:migrate` で `add_estimate_variation_items` マイグレーション生成
  - 生成された migration.sql に CHECK 制約手書き追記:
    - バリエーション: `variation_number 1〜99`, 各種金額 `>= 0`
    - 明細: `sort_order >= 0`, `quantity >= 1`, `unit_price >= 0`, `discount_rate 0〜1`, `item_discount >= 0`, 計算結果 `>= 0`
    - 改訂明細: `delivery_price >= 0`
  - `pnpm prisma migrate reset` で drift 解消
  - `pnpm build` / `pnpm test` / `pnpm lint` で確認
  - `pnpm prisma studio` で 7 テーブル全てが見えること確認
- コミットメッセージ: `feat: バリエーション (EstimateVariation) と明細 (EstimateItem/RevisedEstimateItemDetail) を追加`

## スキーマ DSL（完成形）

### TaxRate (Phase 1)

```prisma
model TaxRate {
  id   String  @id @db.Uuid
  rate Decimal @db.Decimal(4, 3)

  effectiveFrom DateTime @unique @map("effective_from") @db.Timestamptz(3)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@map("tax_rates")
}
```

### Estimate + 修理サブタイプ (Phase 2)

```prisma
enum EstimateType {
  NEW
  REPAIR
  AFTER_REPAIR
}

enum SubmissionType {
  CUSTOMER
  DELIVERY_LOCATION
}

enum TaxRoundingType {
  ROUND_DOWN
  ROUND_UP
  ROUND
}

model Estimate {
  id             String @id @db.Uuid
  estimateNumber String @unique @map("estimate_number") @db.VarChar(8)

  estimateType EstimateType @map("estimate_type")

  fiscalYear Int @map("fiscal_year")
  sequence   Int

  estimateDate DateTime @map("estimate_date") @db.Timestamptz(3)
  deadline     DateTime @db.Timestamptz(3)

  submissionType SubmissionType @map("submission_type")

  customerId         String           @map("customer_id") @db.Uuid
  customer           Customer         @relation("CustomerEstimates", fields: [customerId], references: [id])
  deliveryLocationId String           @map("delivery_location_id") @db.Uuid
  deliveryLocation   DeliveryLocation @relation("DeliveryLocationEstimates", fields: [deliveryLocationId], references: [id])

  repairDetail      RepairEstimateDetail?
  afterRepairDetail AfterRepairEstimateDetail?

  taxRate         Decimal         @map("tax_rate") @db.Decimal(4, 3)
  taxRoundingType TaxRoundingType @map("tax_rounding_type")

  createdBy    String     @map("created_by") @db.Uuid
  creator      Employee   @relation("EstimateCreator", fields: [createdBy], references: [id])
  departmentId String     @map("department_id") @db.Uuid
  department   Department @relation("EstimateDepartment", fields: [departmentId], references: [id])

  variations EstimateVariation[]

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([estimateNumber])
  @@index([fiscalYear, estimateType, sequence])
  @@index([createdBy])
  @@index([departmentId])
  @@index([customerId])
  @@index([deliveryLocationId])
  @@index([submissionType])
  @@map("estimates")
}

model RepairEstimateDetail {
  id         String   @id @db.Uuid
  estimateId String   @unique @map("estimate_id") @db.Uuid
  estimate   Estimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)

  targetProductId String  @map("target_product_id") @db.Uuid
  targetProduct   Product @relation("RepairTargetProduct", fields: [targetProductId], references: [id])

  faultDescription    String   @map("fault_description") @db.VarChar(2000)
  scheduledRepairDate DateTime @map("scheduled_repair_date") @db.Timestamptz(3)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([targetProductId])
  @@map("repair_estimate_details")
}

model AfterRepairEstimateDetail {
  id         String   @id @db.Uuid
  estimateId String   @unique @map("estimate_id") @db.Uuid
  estimate   Estimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)

  targetProductId String  @map("target_product_id") @db.Uuid
  targetProduct   Product @relation("AfterRepairTargetProduct", fields: [targetProductId], references: [id])

  faultDescription String   @map("fault_description") @db.VarChar(2000)
  actualRepairDate DateTime @map("actual_repair_date") @db.Timestamptz(3)
  emergencyReason  String   @map("emergency_reason") @db.VarChar(2000)

  afterServiceWarningAcknowledged Boolean @default(false) @map("after_service_warning_acknowledged")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([targetProductId])
  @@map("after_repair_estimate_details")
}
```

### バリエーション + 明細 + 改訂明細 (Phase 3)

```prisma
enum VariationStatus {
  ACTIVE
  INACTIVE
}

model EstimateVariation {
  id         String   @id @db.Uuid
  estimateId String   @map("estimate_id") @db.Uuid
  estimate   Estimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)

  variationNumber Int             @map("variation_number")
  status          VariationStatus @default(ACTIVE)

  customerMemo String? @map("customer_memo") @db.VarChar(2000)
  internalMemo String? @map("internal_memo") @db.VarChar(2000)

  overallDiscount Decimal @default(0) @map("overall_discount") @db.Decimal(12, 2)

  subtotal         Decimal @db.Decimal(12, 2)
  discountSubtotal Decimal @map("discount_subtotal") @db.Decimal(12, 2)
  finalSubtotal    Decimal @map("final_subtotal") @db.Decimal(12, 2)
  taxAmount        Decimal @map("tax_amount") @db.Decimal(12, 2)
  finalTotal       Decimal @map("final_total") @db.Decimal(12, 2)

  items EstimateItem[]

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@unique([estimateId, variationNumber])
  @@index([estimateId, status])
  @@index([status])
  @@map("estimate_variations")
}

model EstimateItem {
  id          String            @id @db.Uuid
  variationId String            @map("variation_id") @db.Uuid
  variation   EstimateVariation @relation(fields: [variationId], references: [id], onDelete: Cascade)

  sortOrder Int @map("sort_order")

  productId String  @map("product_id") @db.Uuid
  product   Product @relation("EstimateItemProduct", fields: [productId], references: [id])

  itemName  String  @map("item_name") @db.VarChar(100)
  quantity  Int
  unit      String  @db.VarChar(20)
  unitPrice Decimal @map("unit_price") @db.Decimal(12, 2)

  customerMemo String? @map("customer_memo") @db.VarChar(2000)
  internalMemo String? @map("internal_memo") @db.VarChar(2000)

  discountRate Decimal @default(1.0) @map("discount_rate") @db.Decimal(5, 4)
  itemDiscount Decimal @default(0) @map("item_discount") @db.Decimal(12, 2)

  baseAmount       Decimal @map("base_amount") @db.Decimal(12, 2)
  discountedAmount Decimal @map("discounted_amount") @db.Decimal(12, 2)
  finalAmount      Decimal @map("final_amount") @db.Decimal(12, 2)

  revisedDetail RevisedEstimateItemDetail?

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([variationId, sortOrder])
  @@index([productId])
  @@map("estimate_items")
}

model RevisedEstimateItemDetail {
  id             String       @id @db.Uuid
  estimateItemId String       @unique @map("estimate_item_id") @db.Uuid
  estimateItem   EstimateItem @relation(fields: [estimateItemId], references: [id], onDelete: Cascade)

  deliveryPrice Decimal @map("delivery_price") @db.Decimal(12, 2)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@map("revised_estimate_item_details")
}
```

## CHECK 制約 SQL（完成形）

### Phase 1: TaxRate

```sql
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_rate_check"
  CHECK ("rate" >= 0 AND "rate" < 1);
```

### Phase 2: Estimate

```sql
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_fiscal_year_check"
  CHECK ("fiscal_year" >= 2000 AND "fiscal_year" <= 9999);
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_sequence_check"
  CHECK ("sequence" >= 1 AND "sequence" <= 99999);
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_tax_rate_check"
  CHECK ("tax_rate" >= 0 AND "tax_rate" < 1);
```

### Phase 3: バリエーション + 明細 + 改訂明細

```sql
-- バリエーション
ALTER TABLE "estimate_variations" ADD CONSTRAINT "estimate_variations_variation_number_check"
  CHECK ("variation_number" >= 1 AND "variation_number" <= 99);
ALTER TABLE "estimate_variations" ADD CONSTRAINT "estimate_variations_overall_discount_check"
  CHECK ("overall_discount" >= 0);
ALTER TABLE "estimate_variations" ADD CONSTRAINT "estimate_variations_subtotal_check"
  CHECK ("subtotal" >= 0);
ALTER TABLE "estimate_variations" ADD CONSTRAINT "estimate_variations_discount_subtotal_check"
  CHECK ("discount_subtotal" >= 0);
ALTER TABLE "estimate_variations" ADD CONSTRAINT "estimate_variations_final_subtotal_check"
  CHECK ("final_subtotal" >= 0);
ALTER TABLE "estimate_variations" ADD CONSTRAINT "estimate_variations_tax_amount_check"
  CHECK ("tax_amount" >= 0);
ALTER TABLE "estimate_variations" ADD CONSTRAINT "estimate_variations_final_total_check"
  CHECK ("final_total" >= 0);

-- 明細
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_sort_order_check"
  CHECK ("sort_order" >= 0);
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_quantity_check"
  CHECK ("quantity" >= 1);
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_unit_price_check"
  CHECK ("unit_price" >= 0);
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_discount_rate_check"
  CHECK ("discount_rate" >= 0 AND "discount_rate" <= 1);
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_item_discount_check"
  CHECK ("item_discount" >= 0);
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_base_amount_check"
  CHECK ("base_amount" >= 0);
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_discounted_amount_check"
  CHECK ("discounted_amount" >= 0);
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_final_amount_check"
  CHECK ("final_amount" >= 0);

-- 改訂明細詳細
ALTER TABLE "revised_estimate_item_details" ADD CONSTRAINT "revised_estimate_item_details_delivery_price_check"
  CHECK ("delivery_price" >= 0);
```

## シードデータ (Phase 1)

`prisma/seed.ts` に追記:

```ts
// 削除ブロックに追加
await prisma.taxRate.deleteMany();

// 作成ブロック（商品作成の後）
console.log("Creating tax rates...");
const TAX_RATES = [
  { rate: "0.080", effectiveFrom: new Date("2014-04-01T00:00:00+09:00") },
  { rate: "0.100", effectiveFrom: new Date("2019-10-01T00:00:00+09:00") },
];
for (const tr of TAX_RATES) {
  await prisma.taxRate.create({
    data: { id: generateId(), rate: tr.rate, effectiveFrom: tr.effectiveFrom },
  });
}
console.log(`Created ${TAX_RATES.length} tax rates`);
```

## 完了条件

- `prisma/schema.prisma` に 7 モデル + 4 enum が追加されている
- 3 つのマイグレーションが生成され、それぞれ手書きの CHECK 制約が追記されている
- `pnpm prisma migrate reset` が成功する（drift なし）
- `pnpm build` / `pnpm test` / `pnpm lint` がオールグリーン
- `pnpm db:studio` で 7 テーブル（`tax_rates`, `estimates`, `repair_estimate_details`, `after_repair_estimate_details`, `estimate_variations`, `estimate_items`, `revised_estimate_item_details`）が確認できる
- `pnpm prisma db seed` で税率 2 件が投入されている
- 各 Phase が独立したコミットとしてリポジトリに記録されている
