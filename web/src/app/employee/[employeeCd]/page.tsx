import { deleteEmployee } from "@/app/actions/deleteEmployee";
import { updateEmployee } from "@/app/actions/updateEmployee";
import { PrismaEmployeeQueryService } from "@/subdomains/employee/infra/queries/PrismaEmployeeQueryService";
import { GetEmployeeByEmployeeCdQuery } from "@/subdomains/employee/queries/GetEmployeeByEmployeeCdQuery";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ employeeCd: string }>;
}) {
  const { employeeCd } = await params;

  // データ取得（Query側）
  const queryService = new PrismaEmployeeQueryService();
  const getEmployeeQuery = new GetEmployeeByEmployeeCdQuery(queryService);
  const employee = await getEmployeeQuery.execute({ employeeCd: employeeCd });
  if (!employee) {
    notFound();
  }

  // TODO: idはurlで渡すべきじゃないし追加してるけどこれでいいか確認
  const updateUserWithId = updateEmployee.bind(null, employee.id);
  const deleteUserWithId = deleteEmployee.bind(null, employee.id);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">従業員管理</h1>

      {/* 変更フォーム */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">従業員変更</h2>
        <form action={updateUserWithId} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              名前
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={employee.name}
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              name="email"
              defaultValue={employee.email}
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          <div>
            <label
              htmlFor="employeeCd"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              従業員コード
            </label>
            <input
              type="text"
              id="employeeCd"
              name="employeeCd"
              defaultValue={employee.employeeCd}
              disabled
              required
              pattern="EMP[0-9]{6}"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
            <p className="text-gray-600 text-xs mt-1">
              形式: EMP + 6桁の数字（例: EMP000001）
            </p>
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              権限
            </label>
            <select
              id="role"
              name="role"
              required
              defaultValue={employee.role}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="USER">一般ユーザー</option>
              <option value="ADMIN">管理者</option>
            </select>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              更新
            </button>
          </div>
        </form>

        {/* 削除フォーム */}
        <form action={deleteUserWithId} className="mt-4">
          <button
            type="submit"
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            削除
          </button>
        </form>
      </div>
    </div>
  );
}
