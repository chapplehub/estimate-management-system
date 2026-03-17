import Link from "next/link";
import { DepartmentSelectField } from "@/app/_components/form";
import { DepartmentCreateForm } from "./DepartmentCreateForm";

export default function DepartmentNewPage() {
  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link href="/departments" className="text-blue-600 hover:text-blue-800 hover:underline">
          ← 部署一覧に戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">新規部署登録</h1>

      <DepartmentCreateForm
        parentDepartmentSelectSlot={
          <DepartmentSelectField
            name="parentId"
            id="parentId"
            required={false}
            placeholder="親部署を選択してください"
          />
        }
      />

      <div className="mt-4">
        <Link
          href="/departments"
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline inline-block"
        >
          キャンセル
        </Link>
      </div>
    </div>
  );
}
