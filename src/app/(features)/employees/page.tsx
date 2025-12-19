import { getRequiredSession } from "@/app/_lib/getRequiredSession";
import { GetAllEmployeesQuery } from "@subdomains/employee/application/queries/GetAllEmployeesQuery";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import Link from "next/link";

export default async function EmployeePage() {
  const session = await getRequiredSession();
  const isAdmin = session.user.role === "ADMIN";
  // データ取得（Query側）
  const queryService = new PrismaEmployeeQueryService();
  const getAllQuery = new GetAllEmployeesQuery(queryService);
  const employees = await getAllQuery.execute({});

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">従業員管理</h1>
        {isAdmin && (
          <Link
            href="/employees/new"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            新規登録
          </Link>
        )}
      </div>

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
                          employee.role === "ADMIN"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {employee.role === "ADMIN" ? "管理者" : "一般"}
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
