-- CreateTable
CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL,
    "rate" DECIMAL(4,3) NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_effective_from_key" ON "tax_rates"("effective_from");

-- CheckConstraint: 税率は元金額未満（業務制度上 100% 以上は想定外）
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_rate_check"
  CHECK ("rate" >= 0 AND "rate" < 1);
