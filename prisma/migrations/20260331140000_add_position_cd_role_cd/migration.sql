-- AlterTable
ALTER TABLE "positions" ADD COLUMN "position_cd" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN "role_cd" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "positions_position_cd_key" ON "positions"("position_cd");

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_cd_key" ON "roles"("role_cd");
