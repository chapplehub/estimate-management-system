import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import { USER_ROLES, type UserRole } from "@server/shared/auth/types";
import { SearchEmployeesQuery } from "@subdomains/employee/application/queries/SearchEmployeesQuery";
import type { EmployeeSearchCriteria } from "@subdomains/employee/application/queries/dto/EmployeeSearchCriteria";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import Link from "next/link";
import { EmployeeSearchForm } from "./_components/EmployeeSearchForm";

// NOTE: このページの検索機能の実装としては、URLのパスパラメタに基づいて検索を実行する。そのため初期検索は全件取得。
// NOTE: 検索条件を入力して検索ボタンを押すと直接検索APIが実行されるのではなく、まず入力した検索条件をパスパラメタに設定してナビゲーションし、レンダリング時に検索処理が実行される。

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// ヘルパー関数: 文字列値を安全に取得
function getStringParam(
  params: Awaited<SearchParams>,
  key: string
): string | undefined {
  const value = params[key];
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return undefined;
}

// ヘルパー関数: role値を検証
function validateRole(value: string | undefined): UserRole | undefined {
  if (value === USER_ROLES.ADMIN || value === USER_ROLES.USER) {
    return value;
  }
  return undefined;
}

export default async function EmployeePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await verifySession();
  const params = await searchParams;

  // 検索条件の構築
  const criteria: EmployeeSearchCriteria = {
    name: getStringParam(params, "name"),
    email: getStringParam(params, "email"),
    employeeCd: getStringParam(params, "employeeCd"),
    role: validateRole(getStringParam(params, "role")),
  };

  // 検索実行
  const queryService = new PrismaEmployeeQueryService();
  const searchQuery = new SearchEmployeesQuery(queryService);
  const employees = await searchQuery.execute({
    criteria,
    options: {
      orderBy: { field: "employeeCd", direction: "asc" },
    },
  });

  // Client Componentに渡すdefaultValues
  const defaultSearchValues = {
    name: getStringParam(params, "name") ?? "",
    email: getStringParam(params, "email") ?? "",
    employeeCd: getStringParam(params, "employeeCd") ?? "",
    role: getStringParam(params, "role") ?? "",
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-2">
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

      {/* 検索フォーム */}
      <EmployeeSearchForm defaultValues={defaultSearchValues} />

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
                          employee.role === USER_ROLES.ADMIN
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {employee.role === USER_ROLES.ADMIN ? "管理者" : "一般"}
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
