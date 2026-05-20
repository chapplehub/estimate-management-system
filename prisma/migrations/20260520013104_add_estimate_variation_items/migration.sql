-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "estimate_variations" (
    "id" UUID NOT NULL,
    "estimate_id" UUID NOT NULL,
    "variation_number" INTEGER NOT NULL,
    "status" "VariationStatus" NOT NULL DEFAULT 'ACTIVE',
    "customer_memo" VARCHAR(2000),
    "internal_memo" VARCHAR(2000),
    "overall_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_subtotal" DECIMAL(12,2) NOT NULL,
    "final_subtotal" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL,
    "final_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_items" (
    "id" UUID NOT NULL,
    "variation_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "item_name" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "customer_memo" VARCHAR(2000),
    "internal_memo" VARCHAR(2000),
    "discount_rate" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "item_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "discounted_amount" DECIMAL(12,2) NOT NULL,
    "final_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revised_estimate_item_details" (
    "id" UUID NOT NULL,
    "estimate_item_id" UUID NOT NULL,
    "delivery_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "revised_estimate_item_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estimate_variations_estimate_id_status_idx" ON "estimate_variations"("estimate_id", "status");

-- CreateIndex
CREATE INDEX "estimate_variations_status_idx" ON "estimate_variations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_variations_estimate_id_variation_number_key" ON "estimate_variations"("estimate_id", "variation_number");

-- CreateIndex
CREATE INDEX "estimate_items_variation_id_sort_order_idx" ON "estimate_items"("variation_id", "sort_order");

-- CreateIndex
CREATE INDEX "estimate_items_product_id_idx" ON "estimate_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "revised_estimate_item_details_estimate_item_id_key" ON "revised_estimate_item_details"("estimate_item_id");

-- AddForeignKey
ALTER TABLE "estimate_variations" ADD CONSTRAINT "estimate_variations_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "estimate_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revised_estimate_item_details" ADD CONSTRAINT "revised_estimate_item_details_estimate_item_id_fkey" FOREIGN KEY ("estimate_item_id") REFERENCES "estimate_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: バリエーション
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

-- CheckConstraint: 明細
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

-- CheckConstraint: 改訂明細詳細
ALTER TABLE "revised_estimate_item_details" ADD CONSTRAINT "revised_estimate_item_details_delivery_price_check"
  CHECK ("delivery_price" >= 0);
