-- CreateEnum
CREATE TYPE "EstimateExemptionReason" AS ENUM ('CONSUMABLE_ONLY', 'BELOW_THRESHOLD', 'AFTER_REPAIR');

-- CreateTable
CREATE TABLE "estimate_applications" (
    "id" UUID NOT NULL,
    "variation_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "applicant_employee_id" UUID NOT NULL,
    "final_approval_position_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_approval_steps" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_step_approvals" (
    "step_id" UUID NOT NULL,
    "approver_employee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_step_approvals_pkey" PRIMARY KEY ("step_id")
);

-- CreateTable
CREATE TABLE "estimate_step_rejections" (
    "step_id" UUID NOT NULL,
    "rejected_by_employee_id" UUID NOT NULL,
    "comment" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_step_rejections_pkey" PRIMARY KEY ("step_id")
);

-- CreateTable
CREATE TABLE "estimate_application_withdrawals" (
    "application_id" UUID NOT NULL,
    "withdrawn_by_employee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_application_withdrawals_pkey" PRIMARY KEY ("application_id")
);

-- CreateTable
CREATE TABLE "estimate_approval_exemptions" (
    "id" UUID NOT NULL,
    "variation_id" UUID NOT NULL,
    "reason" "EstimateExemptionReason" NOT NULL,
    "exempted_by_employee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_approval_exemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estimate_applications_variation_id_idx" ON "estimate_applications"("variation_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_applications_variation_id_attempt_key" ON "estimate_applications"("variation_id", "attempt");

-- CreateIndex
CREATE INDEX "estimate_approval_steps_role_id_idx" ON "estimate_approval_steps"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_approval_steps_application_id_step_order_key" ON "estimate_approval_steps"("application_id", "step_order");

-- CreateIndex
CREATE INDEX "estimate_step_approvals_approver_employee_id_idx" ON "estimate_step_approvals"("approver_employee_id");

-- CreateIndex
CREATE INDEX "estimate_step_rejections_rejected_by_employee_id_idx" ON "estimate_step_rejections"("rejected_by_employee_id");

-- CreateIndex
CREATE INDEX "estimate_application_withdrawals_withdrawn_by_employee_id_idx" ON "estimate_application_withdrawals"("withdrawn_by_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_approval_exemptions_variation_id_key" ON "estimate_approval_exemptions"("variation_id");

-- CreateIndex
CREATE INDEX "estimate_approval_exemptions_exempted_by_employee_id_idx" ON "estimate_approval_exemptions"("exempted_by_employee_id");

-- AddForeignKey
ALTER TABLE "estimate_applications" ADD CONSTRAINT "estimate_applications_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "estimate_variations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_applications" ADD CONSTRAINT "estimate_applications_applicant_employee_id_fkey" FOREIGN KEY ("applicant_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_applications" ADD CONSTRAINT "estimate_applications_final_approval_position_id_fkey" FOREIGN KEY ("final_approval_position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_approval_steps" ADD CONSTRAINT "estimate_approval_steps_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "estimate_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_approval_steps" ADD CONSTRAINT "estimate_approval_steps_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_step_approvals" ADD CONSTRAINT "estimate_step_approvals_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "estimate_approval_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_step_approvals" ADD CONSTRAINT "estimate_step_approvals_approver_employee_id_fkey" FOREIGN KEY ("approver_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_step_rejections" ADD CONSTRAINT "estimate_step_rejections_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "estimate_approval_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_step_rejections" ADD CONSTRAINT "estimate_step_rejections_rejected_by_employee_id_fkey" FOREIGN KEY ("rejected_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_application_withdrawals" ADD CONSTRAINT "estimate_application_withdrawals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "estimate_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_application_withdrawals" ADD CONSTRAINT "estimate_application_withdrawals_withdrawn_by_employee_id_fkey" FOREIGN KEY ("withdrawn_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_approval_exemptions" ADD CONSTRAINT "estimate_approval_exemptions_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "estimate_variations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_approval_exemptions" ADD CONSTRAINT "estimate_approval_exemptions_exempted_by_employee_id_fkey" FOREIGN KEY ("exempted_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint（ADR-0019: 数値カラムの下限。手書きSQL）
ALTER TABLE "estimate_applications" ADD CONSTRAINT "estimate_applications_attempt_check"
  CHECK ("attempt" >= 1);
ALTER TABLE "estimate_approval_steps" ADD CONSTRAINT "estimate_approval_steps_step_order_check"
  CHECK ("step_order" >= 1);
