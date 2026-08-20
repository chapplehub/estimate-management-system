-- 全ID/FKカラムをTEXT→PostgreSQLネイティブUUID型に変換
-- 既存データはUUIDv7形式文字列のため ::uuid キャストで変換可能
-- FK制約をDROP → ALTER TYPE → FK制約を再ADDの3フェーズで実施

-- ============================================
-- Phase 1: FK制約をすべてDROP
-- ============================================

-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_company_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_locations" DROP CONSTRAINT "delivery_locations_company_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_locations" DROP CONSTRAINT "delivery_locations_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_roles" DROP CONSTRAINT "employee_roles_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_roles" DROP CONSTRAINT "employee_roles_role_id_fkey";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_department_id_fkey";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_superior_role_id_fkey";

-- DropForeignKey
ALTER TABLE "positions" DROP CONSTRAINT "positions_superior_position_id_fkey";

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_position_id_fkey";

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_superior_role_id_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";

-- DropForeignKey
ALTER TABLE "user" DROP CONSTRAINT "user_employee_id_fkey";

-- ============================================
-- Phase 2: 全カラムの型をTEXT→UUIDに変換
-- ============================================

-- positions
ALTER TABLE "positions" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
ALTER COLUMN "superior_position_id" SET DATA TYPE UUID USING "superior_position_id"::uuid;

-- roles
ALTER TABLE "roles" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
ALTER COLUMN "superior_role_id" SET DATA TYPE UUID USING "superior_role_id"::uuid,
ALTER COLUMN "position_id" SET DATA TYPE UUID USING "position_id"::uuid;

-- employee_roles
ALTER TABLE "employee_roles" ALTER COLUMN "employee_id" SET DATA TYPE UUID USING "employee_id"::uuid,
ALTER COLUMN "role_id" SET DATA TYPE UUID USING "role_id"::uuid;

-- departments
ALTER TABLE "departments" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
ALTER COLUMN "parent_id" SET DATA TYPE UUID USING "parent_id"::uuid;

-- employees
ALTER TABLE "employees" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
ALTER COLUMN "department_id" SET DATA TYPE UUID USING "department_id"::uuid,
ALTER COLUMN "superior_role_id" SET DATA TYPE UUID USING "superior_role_id"::uuid;

-- companies
ALTER TABLE "companies" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid;

-- customers
ALTER TABLE "customers" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
ALTER COLUMN "company_id" SET DATA TYPE UUID USING "company_id"::uuid;

-- delivery_locations
ALTER TABLE "delivery_locations" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
ALTER COLUMN "company_id" SET DATA TYPE UUID USING "company_id"::uuid,
ALTER COLUMN "customer_id" SET DATA TYPE UUID USING "customer_id"::uuid;

-- user
ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
ALTER COLUMN "employee_id" SET DATA TYPE UUID USING "employee_id"::uuid;

-- session
ALTER TABLE "session" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
ALTER COLUMN "userId" SET DATA TYPE UUID USING "userId"::uuid,
ALTER COLUMN "impersonatedBy" SET DATA TYPE UUID USING "impersonatedBy"::uuid;

-- account
ALTER TABLE "account" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
ALTER COLUMN "userId" SET DATA TYPE UUID USING "userId"::uuid;

-- verification
ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid;

-- ============================================
-- Phase 3: FK制約を再ADD
-- ============================================

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
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_superior_role_id_fkey" FOREIGN KEY ("superior_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_locations" ADD CONSTRAINT "delivery_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_locations" ADD CONSTRAINT "delivery_locations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
