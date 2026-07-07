import Link from "next/link";
import { DepartmentSelectField } from "@/app/_components/form";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { EmployeeCreateForm } from "./EmployeeCreateForm";

export default async function EmployeeNewPage() {
  // 担当役割の選択肢を供給（承認者不在ワーニングの反応性のためフォームに値を所有させる方針・A2）。
  // ラベルは name のみ、roleCd 昇順（DepartmentSelectField と同方針）。
  const roleQueryService = new PrismaRoleQueryService();
  const roles = await roleQueryService.findAll({
    orderBy: { field: "roleCd", direction: "asc" },
  });
  const roleOptions = roles.map((role) => ({ id: role.id, name: role.name }));

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link href="/employees" className="text-blue-600 hover:text-blue-800 hover:underline">
          ← 従業員一覧に戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">新規従業員登録</h1>

      {/* 作成フォーム */}
      <EmployeeCreateForm
        departmentSelectSlot={<DepartmentSelectField name="departmentId" id="departmentId" />}
        roleOptions={roleOptions}
      />

      <div className="mt-4">
        <Link
          href="/employees"
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline inline-block"
        >
          キャンセル
        </Link>
      </div>
    </div>
  );
}
