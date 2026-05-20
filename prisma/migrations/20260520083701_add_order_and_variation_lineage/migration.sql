-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "variation_id" UUID NOT NULL,
    "order_note" VARCHAR(2000),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_confirmations" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "delivery_date" TIMESTAMPTZ(3) NOT NULL,
    "confirmed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_cancellations" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "cancelled_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_variation_copies" (
    "id" UUID NOT NULL,
    "copied_variation_id" UUID NOT NULL,
    "source_variation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_variation_copies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_variation_revisions" (
    "id" UUID NOT NULL,
    "revised_variation_id" UUID NOT NULL,
    "source_variation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_variation_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_variation_id_key" ON "orders"("variation_id");

-- CreateIndex
CREATE INDEX "orders_variation_id_idx" ON "orders"("variation_id");

-- CreateIndex
CREATE INDEX "orders_created_by_idx" ON "orders"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "order_confirmations_order_id_key" ON "order_confirmations"("order_id");

-- CreateIndex
CREATE INDEX "order_confirmations_confirmed_by_idx" ON "order_confirmations"("confirmed_by");

-- CreateIndex
CREATE UNIQUE INDEX "order_cancellations_order_id_key" ON "order_cancellations"("order_id");

-- CreateIndex
CREATE INDEX "order_cancellations_cancelled_by_idx" ON "order_cancellations"("cancelled_by");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_variation_copies_copied_variation_id_key" ON "estimate_variation_copies"("copied_variation_id");

-- CreateIndex
CREATE INDEX "estimate_variation_copies_source_variation_id_idx" ON "estimate_variation_copies"("source_variation_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_variation_revisions_revised_variation_id_key" ON "estimate_variation_revisions"("revised_variation_id");

-- CreateIndex
CREATE INDEX "estimate_variation_revisions_source_variation_id_idx" ON "estimate_variation_revisions"("source_variation_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "estimate_variations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_confirmations" ADD CONSTRAINT "order_confirmations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_confirmations" ADD CONSTRAINT "order_confirmations_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_variation_copies" ADD CONSTRAINT "estimate_variation_copies_copied_variation_id_fkey" FOREIGN KEY ("copied_variation_id") REFERENCES "estimate_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_variation_copies" ADD CONSTRAINT "estimate_variation_copies_source_variation_id_fkey" FOREIGN KEY ("source_variation_id") REFERENCES "estimate_variations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_variation_revisions" ADD CONSTRAINT "estimate_variation_revisions_revised_variation_id_fkey" FOREIGN KEY ("revised_variation_id") REFERENCES "estimate_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_variation_revisions" ADD CONSTRAINT "estimate_variation_revisions_source_variation_id_fkey" FOREIGN KEY ("source_variation_id") REFERENCES "estimate_variations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
