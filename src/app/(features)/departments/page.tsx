import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import {
  getAllDepartmentsQueryFactory,
  searchDepartmentsQueryFactory,
} from "@subdomains/department/application/factories/departmentQueryFactory";
import type { DepartmentSearchCriteria } from "@subdomains/department/application/queries/dto/DepartmentSearchCriteria";
import Link from "next/link";
import { DepartmentSearchForm } from "./_components/DepartmentSearchForm";
import { Pagination } from "@/app/_components/shared/Pagination";
import { Badge } from "@/app/_components/shadcnui/badge";

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

// ヘルパー関数: isActive値を検証
function validateIsActive(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export default async function DepartmentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await verifySession();
  const params = await searchParams;

  // 検索条件の構築
  const criteria: DepartmentSearchCriteria = {
    name: getStringParam(params, "name"),
    abbreviation: getStringParam(params, "abbreviation"),
    departmentCd: getStringParam(params, "departmentCd"),
    isActive: validateIsActive(getStringParam(params, "isActive")),
  };

  // ページ番号の取得
  const currentPage = getPageParam(params);

  // 検索実行（ページネーション付き）
  const searchQuery = searchDepartmentsQueryFactory();
  const result = await searchQuery.executeWithPagination({
    criteria,
    pagination: {
      page: currentPage,
      pageSize: PAGE_SIZE,
    },
    orderBy: { field: "displayOrder", direction: "asc" },
  });

  // 親部署名解決: 全部署取得してMap構築
  const getAllQuery = getAllDepartmentsQueryFactory();
  const allDepartments = await getAllQuery.execute({});
  const parentNameMap = new Map(allDepartments.map((dept) => [dept.id, dept.name]));

  // Client Componentに渡すdefaultValues
  const defaultSearchValues = {
    name: getStringParam(params, "name") ?? "",
    abbreviation: getStringParam(params, "abbreviation") ?? "",
    departmentCd: getStringParam(params, "departmentCd") ?? "",
    isActive: getStringParam(params, "isActive") ?? "",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">部署管理</h1>
        {isAdmin(session) && (
          <Link
            href="/departments/new"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            新規登録
          </Link>
        )}
      </div>

      {/* 検索フォーム */}
      <div className="px-4">
        <DepartmentSearchForm defaultValues={defaultSearchValues} />
      </div>

      {/* 一覧表示 */}
      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">部署一覧</h2>
        </div>

        {/* テーブルコンテナ - 縦スクロール可能 */}
        <div className="flex-1 overflow-hidden px-8">
          <div className="h-full overflow-y-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-left">部署コード</th>
                  <th className="px-4 py-2 text-left">部署名</th>
                  <th className="px-4 py-2 text-left">略称</th>
                  <th className="px-4 py-2 text-left">親部署名</th>
                  <th className="px-4 py-2 text-left">表示順</th>
                  <th className="px-4 py-2 text-left">状態</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                      部署が登録されていません
                    </td>
                  </tr>
                ) : (
                  result.items.map((dept) => (
                    <tr key={dept.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/departments/${dept.departmentCd}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {dept.departmentCd}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{dept.name}</td>
                      <td className="px-4 py-2">{dept.abbreviation}</td>
                      <td className="px-4 py-2">
                        {dept.parentId ? (parentNameMap.get(dept.parentId) ?? "-") : "-"}
                      </td>
                      <td className="px-4 py-2">{dept.displayOrder}</td>
                      <td className="px-4 py-2">
                        <Badge variant={dept.isActive ? "default" : "secondary"}>
                          {dept.isActive ? "有効" : "無効"}
                        </Badge>
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
