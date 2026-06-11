/*
  Warnings:

  - The primary key for the `estimate_variation_copies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `estimate_variation_copies` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "estimate_variation_copies_copied_variation_id_key";

-- AlterTable
ALTER TABLE "estimate_variation_copies" DROP CONSTRAINT "estimate_variation_copies_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "estimate_variation_copies_pkey" PRIMARY KEY ("copied_variation_id");
