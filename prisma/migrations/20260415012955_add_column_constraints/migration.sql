/*
  Warnings:

  - You are about to alter the column `code` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `name` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `postal_code` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(7)`.
  - You are about to alter the column `prefecture` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(4)`.
  - You are about to alter the column `address` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to alter the column `phone_number` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(11)`.
  - You are about to alter the column `fax_number` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(11)`.
  - You are about to alter the column `contact_person` on the `companies` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `delivery_notes` on the `delivery_locations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `department_cd` on the `departments` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(7)`.
  - You are about to alter the column `name` on the `departments` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `abbreviation` on the `departments` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `employee_cd` on the `employees` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(9)`.
  - You are about to alter the column `email` on the `employees` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(254)`.
  - You are about to alter the column `name` on the `employees` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `name` on the `positions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `position_cd` on the `positions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(6)`.
  - You are about to alter the column `code` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `name` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `description` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1000)`.
  - You are about to alter the column `note` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1000)`.
  - You are about to alter the column `name` on the `roles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `role_cd` on the `roles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(7)`.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "code" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "postal_code" SET DATA TYPE VARCHAR(7),
ALTER COLUMN "prefecture" SET DATA TYPE VARCHAR(4),
ALTER COLUMN "address" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "phone_number" SET DATA TYPE VARCHAR(11),
ALTER COLUMN "fax_number" SET DATA TYPE VARCHAR(11),
ALTER COLUMN "contact_person" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "delivery_locations" ALTER COLUMN "delivery_notes" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "departments" ALTER COLUMN "department_cd" SET DATA TYPE VARCHAR(7),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "abbreviation" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "employee_cd" SET DATA TYPE VARCHAR(9),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(254),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "positions" ALTER COLUMN "name" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "position_cd" SET DATA TYPE VARCHAR(6);

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "code" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(1000),
ALTER COLUMN "note" SET DATA TYPE VARCHAR(1000);

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "role_cd" SET DATA TYPE VARCHAR(7);

-- CheckConstraints: 数値カラムの範囲制約
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_quantity_check" CHECK ("quantity" >= 1);
ALTER TABLE "set_product_components" ADD CONSTRAINT "set_product_components_quantity_check" CHECK ("quantity" >= 1);
ALTER TABLE "customers" ADD CONSTRAINT "customers_margin_rate_check" CHECK ("margin_rate" >= 0 AND "margin_rate" <= 100);
ALTER TABLE "products" ADD CONSTRAINT "products_cost_price_check" CHECK ("cost_price" >= 0);
