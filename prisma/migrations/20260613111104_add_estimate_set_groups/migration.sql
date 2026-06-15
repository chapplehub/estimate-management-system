-- CreateTable
CREATE TABLE "estimate_set_groups" (
    "id" UUID NOT NULL,
    "variation_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "item_name" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "customer_memo" VARCHAR(2000) NOT NULL DEFAULT '',
    "internal_memo" VARCHAR(2000) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_set_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_set_components" (
    "item_id" UUID NOT NULL,
    "set_group_id" UUID NOT NULL,

    CONSTRAINT "estimate_set_components_pkey" PRIMARY KEY ("item_id")
);

-- CreateIndex
CREATE INDEX "estimate_set_groups_variation_id_idx" ON "estimate_set_groups"("variation_id");

-- CreateIndex
CREATE INDEX "estimate_set_groups_product_id_idx" ON "estimate_set_groups"("product_id");

-- CreateIndex
CREATE INDEX "estimate_set_components_set_group_id_idx" ON "estimate_set_components"("set_group_id");

-- AddForeignKey
ALTER TABLE "estimate_set_groups" ADD CONSTRAINT "estimate_set_groups_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "estimate_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_set_groups" ADD CONSTRAINT "estimate_set_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_set_components" ADD CONSTRAINT "estimate_set_components_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "estimate_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_set_components" ADD CONSTRAINT "estimate_set_components_set_group_id_fkey" FOREIGN KEY ("set_group_id") REFERENCES "estimate_set_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
