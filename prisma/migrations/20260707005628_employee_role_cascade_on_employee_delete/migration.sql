-- DropForeignKey
ALTER TABLE "employee_roles" DROP CONSTRAINT "employee_roles_employee_id_fkey";

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
