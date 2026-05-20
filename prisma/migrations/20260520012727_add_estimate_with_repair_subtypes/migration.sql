-- CreateEnum
CREATE TYPE "EstimateType" AS ENUM ('NEW', 'REPAIR', 'AFTER_REPAIR');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('CUSTOMER', 'DELIVERY_LOCATION');

-- CreateEnum
CREATE TYPE "TaxRoundingType" AS ENUM ('ROUND_DOWN', 'ROUND_UP', 'ROUND');

-- CreateTable
CREATE TABLE "estimates" (
    "id" UUID NOT NULL,
    "estimate_number" VARCHAR(8) NOT NULL,
    "estimate_type" "EstimateType" NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "estimate_date" TIMESTAMPTZ(3) NOT NULL,
    "deadline" TIMESTAMPTZ(3) NOT NULL,
    "submission_type" "SubmissionType" NOT NULL,
    "customer_id" UUID NOT NULL,
    "delivery_location_id" UUID NOT NULL,
    "tax_rate" DECIMAL(4,3) NOT NULL,
    "tax_rounding_type" "TaxRoundingType" NOT NULL,
    "created_by" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_estimate_details" (
    "id" UUID NOT NULL,
    "estimate_id" UUID NOT NULL,
    "target_product_id" UUID NOT NULL,
    "fault_description" VARCHAR(2000) NOT NULL,
    "scheduled_repair_date" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "repair_estimate_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "after_repair_estimate_details" (
    "id" UUID NOT NULL,
    "estimate_id" UUID NOT NULL,
    "target_product_id" UUID NOT NULL,
    "fault_description" VARCHAR(2000) NOT NULL,
    "actual_repair_date" TIMESTAMPTZ(3) NOT NULL,
    "emergency_reason" VARCHAR(2000) NOT NULL,
    "after_service_warning_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "after_repair_estimate_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estimates_estimate_number_key" ON "estimates"("estimate_number");

-- CreateIndex
CREATE INDEX "estimates_estimate_number_idx" ON "estimates"("estimate_number");

-- CreateIndex
CREATE INDEX "estimates_fiscal_year_estimate_type_sequence_idx" ON "estimates"("fiscal_year", "estimate_type", "sequence");

-- CreateIndex
CREATE INDEX "estimates_created_by_idx" ON "estimates"("created_by");

-- CreateIndex
CREATE INDEX "estimates_department_id_idx" ON "estimates"("department_id");

-- CreateIndex
CREATE INDEX "estimates_customer_id_idx" ON "estimates"("customer_id");

-- CreateIndex
CREATE INDEX "estimates_delivery_location_id_idx" ON "estimates"("delivery_location_id");

-- CreateIndex
CREATE INDEX "estimates_submission_type_idx" ON "estimates"("submission_type");

-- CreateIndex
CREATE UNIQUE INDEX "repair_estimate_details_estimate_id_key" ON "repair_estimate_details"("estimate_id");

-- CreateIndex
CREATE INDEX "repair_estimate_details_target_product_id_idx" ON "repair_estimate_details"("target_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "after_repair_estimate_details_estimate_id_key" ON "after_repair_estimate_details"("estimate_id");

-- CreateIndex
CREATE INDEX "after_repair_estimate_details_target_product_id_idx" ON "after_repair_estimate_details"("target_product_id");

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "delivery_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_estimate_details" ADD CONSTRAINT "repair_estimate_details_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_estimate_details" ADD CONSTRAINT "repair_estimate_details_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "after_repair_estimate_details" ADD CONSTRAINT "after_repair_estimate_details_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "after_repair_estimate_details" ADD CONSTRAINT "after_repair_estimate_details_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: 採番関連の範囲
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_fiscal_year_check"
  CHECK ("fiscal_year" >= 2000 AND "fiscal_year" <= 9999);
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_sequence_check"
  CHECK ("sequence" >= 1 AND "sequence" <= 99999);

-- CheckConstraint: 税率は元金額未満
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_tax_rate_check"
  CHECK ("tax_rate" >= 0 AND "tax_rate" < 1);
