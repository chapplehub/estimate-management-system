-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "superior_role_id" TEXT;

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "superior_position_id" TEXT,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "superior_role_id" TEXT,
    "position_id" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_roles" (
    "employee_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "employee_roles_pkey" PRIMARY KEY ("employee_id","role_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");

-- CreateIndex
CREATE INDEX "roles_position_id_idx" ON "roles"("position_id");

-- CreateIndex
CREATE INDEX "employees_superior_role_id_idx" ON "employees"("superior_role_id");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_superior_position_id_fkey" FOREIGN KEY ("superior_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_superior_role_id_fkey" FOREIGN KEY ("superior_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_superior_role_id_fkey" FOREIGN KEY ("superior_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
