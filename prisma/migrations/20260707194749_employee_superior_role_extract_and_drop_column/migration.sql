-- 従業員の上位役割を再設計する（ADR-20260707-k4e）
--
-- 従来 employees.superior_role_id（nullable 列）に混在保持していた上位役割を整理する：
--   役割持ち: 保存せず findSuperiorRoleId が担当役割から読み取り時導出する（列不要）
--   課員    : 明示値のみ子表 employee_superior_roles（employee_id を PK とする 1:0..1）へ抽出する
-- 旧列の値は役割持ち＝導出可能な冗長コピー、課員＝一部が無効（課長級でない）ため引き継がず、
-- seed / seed-e2e が正しい課長級で再作成する（Step 11・移行相ではなく作り直し）。

-- CreateTable: 課員の明示上位役割（行の存在 ⟺ 課員に上位役割が明示設定されている）
CREATE TABLE "employee_superior_roles" (
    "employee_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_superior_roles_pkey" PRIMARY KEY ("employee_id")
);

-- CreateIndex
CREATE INDEX "employee_superior_roles_role_id_idx" ON "employee_superior_roles"("role_id");

-- AddForeignKey: 従業員 → employees（集約ルート。従業員削除で明示行も心中）
ALTER TABLE "employee_superior_roles" ADD CONSTRAINT "employee_superior_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: 上位役割 → roles（マスタ。使用中の役割は削除させない = RESTRICT）
ALTER TABLE "employee_superior_roles" ADD CONSTRAINT "employee_superior_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey: 旧 employees.superior_role_id → roles
ALTER TABLE "employees" DROP CONSTRAINT "employees_superior_role_id_fkey";

-- DropIndex
DROP INDEX "employees_superior_role_id_idx";

-- DropColumn: 上位役割の非正規化コピー列を廃止（NULL 徹底排除・二重管理の解消）
ALTER TABLE "employees" DROP COLUMN "superior_role_id";
