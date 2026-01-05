import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import { GetAllEmployeesQuery } from "@subdomains/employee/application/queries/GetAllEmployeesQuery";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import Link from "next/link";

export default async function EmployeePage() {
  const session = await verifySession();
  // データ取得（Query側）
  const queryService = new PrismaEmployeeQueryService();
  const getAllQuery = new GetAllEmployeesQuery(queryService);
  // TODO: 検索できるようにする。今は連弾リングの最初にデータを取得してるだけ
  // TODO: IEmployeeQueryServiceのsearchを呼ぶ処理
  const employees = await getAllQuery.execute({});

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">従業員管理</h1>
        {isAdmin(session) && (
          <Link
            href="/employees/new"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            新規登録
          </Link>
        )}
      </div>

      {/* TODO: ここで検索コンポーネントを入れる。表示件数は20件 取得してくるのは1000件 1000件を超える場合は検索条件を絞るようにエラー表示する */}
      {/* TODO: 従業員に退職フラグを付けるか検討する */}
      {/* TODO: ページネーション機能をつける */}

      {/* 一覧表示 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 text-gray-500">
        <h2 className="text-xl font-semibold mb-4">従業員一覧</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-2 text-left">従業員コード</th>
                <th className="px-4 py-2 text-left">名前</th>
                <th className="px-4 py-2 text-left">メールアドレス</th>
                <th className="px-4 py-2 text-left">権限</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    従業員が登録されていません
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="border-b hover:bg-gray-60">
                    <td className="px-4 py-2">
                      <Link
                        href={`/employees/${employee.employeeCd}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {employee.employeeCd}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{employee.name}</td>
                    <td className="px-4 py-2">{employee.email}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          employee.role === "admin"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {employee.role === "admin" ? "管理者" : "一般"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
