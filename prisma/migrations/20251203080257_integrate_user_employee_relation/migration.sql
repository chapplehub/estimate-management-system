/*
  Warnings:

  - You are about to drop the column `failed_login_attempts` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `last_login_at` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `locked_until` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `password_hash` on the `employees` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[employee_id]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "employees" DROP COLUMN "failed_login_attempts",
DROP COLUMN "last_login_at",
DROP COLUMN "locked_until",
DROP COLUMN "password_hash";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "employee_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_employee_id_key" ON "user"("employee_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
