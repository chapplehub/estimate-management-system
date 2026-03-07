import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import { USER_ROLES, type UserRole } from "@server/shared/auth/types";
import { SearchEmployeesQuery } from "@subdomains/employee/application/queries/SearchEmployeesQuery";
import type { EmployeeSearchCriteria } from "@subdomains/employee/application/queries/dto/EmployeeSearchCriteria";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import Link from "next/link";
import { EmployeeSearchForm } from "./_components/EmployeeSearchForm";
import { Pagination } from "@/app/_components/shared/Pagination";

// NOTE: このページの検索機能の実装としては、URLのパスパラメタに基づいて検索を実行する。そのため初期検索は全件取得。
// NOTE: 検索条件を入力して検索ボタンを押すと直接検索APIが実行されるのではなく、まず入力した検索条件をパスパラメタに設定してナビゲーションし、レンダリング時に検索処理が実行される。

// ページネーション設定
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

type SearchParams = { [key: string]: string | string[] | undefined };

// ヘルパー関数: 文字列値を安全に取得
function getStringParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return undefined;
}

// ヘルパー関数: ページ番号を安全に取得
function getPageParam(params: SearchParams): number {
  const value = params["page"];
  if (typeof value === "string") {
    const page = parseInt(value, 10);
    if (!isNaN(page) && page >= 1 && page <= MAX_PAGES) {
      return page;
    }
  }
  return 1;
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
  searchParams: Promise<SearchParams>;
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

  // ページ番号の取得
  const currentPage = getPageParam(params);

  // 検索実行（ページネーション付き）
  const queryService = new PrismaEmployeeQueryService();
  const searchQuery = new SearchEmployeesQuery(queryService);
  const result = await searchQuery.executeWithPagination({
    criteria,
    pagination: {
      page: currentPage,
      pageSize: PAGE_SIZE,
    },
    orderBy: { field: "employeeCd", direction: "asc" },
  });

  // Client Componentに渡すdefaultValues
  const defaultSearchValues = {
    name: getStringParam(params, "name") ?? "",
    email: getStringParam(params, "email") ?? "",
    employeeCd: getStringParam(params, "employeeCd") ?? "",
    role: getStringParam(params, "role") ?? "",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
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
      <div className="px-4">
        <EmployeeSearchForm defaultValues={defaultSearchValues} />
      </div>

      {/* 一覧表示 */}
      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">従業員一覧</h2>
        </div>

        {/* テーブルコンテナ - 縦スクロール可能 */}
        <div className="flex-1 overflow-hidden px-8">
          <div className="h-full overflow-y-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-left">従業員コード</th>
                  <th className="px-4 py-2 text-left">名前</th>
                  <th className="px-4 py-2 text-left">メールアドレス</th>
                  <th className="px-4 py-2 text-left">権限</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                      従業員が登録されていません
                    </td>
                  </tr>
                ) : (
                  result.items.map((employee) => (
                    <tr key={employee.id} className="border-b hover:bg-gray-50">
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

        {/* ページネーション */}
        <div className="shrink-0">
          <Pagination
            currentPage={result.currentPage}
            totalPages={result.totalPages}
            totalCount={result.totalCount}
            pageSize={result.pageSize}
            maxPages={MAX_PAGES}
          />
        </div>
      </div>
    </div>
  );
}
