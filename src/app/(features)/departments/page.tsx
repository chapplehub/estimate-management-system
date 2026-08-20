import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import {
  getAllDepartmentsQueryFactory,
  searchDepartmentsQueryFactory,
} from "@subdomains/department/application/factories/departmentQueryFactory";
import type { DepartmentSearchCriteria } from "@subdomains/department/application/queries/dto/DepartmentSearchCriteria";
import Link from "next/link";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { DataTable } from "@/app/_components/shared/DataTable";
import { columns, type DepartmentRow } from "./_components/columns";
import { type SearchParams, LIST_FETCH_LIMIT, getStringParam } from "@/app/_lib/searchParams";

// ヘルパー関数: isActive値を検証
function validateIsActive(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

// 検索フォームのフィールド定義
const searchFields: SearchFieldDef[] = [
  { type: "text", key: "name", label: "部署名", placeholder: "部分一致" },
  { type: "text", key: "abbreviation", label: "略称", placeholder: "部分一致" },
  { type: "text", key: "departmentCd", label: "部署コード", placeholder: "完全一致" },
  {
    type: "select",
    key: "isActive",
    label: "状態",
    options: [
      { value: "true", label: "有効" },
      { value: "false", label: "無効" },
    ],
  },
];

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

  // 検索実行（最大 LIST_FETCH_LIMIT 件を一括取得）
  const searchQuery = searchDepartmentsQueryFactory();
  const departments = await searchQuery.execute({
    criteria,
    options: { limit: LIST_FETCH_LIMIT, orderBy: { field: "departmentCd", direction: "asc" } },
  });

  // 親部署名解決: 全部署取得してMap構築
  const getAllQuery = getAllDepartmentsQueryFactory();
  const allDepartments = await getAllQuery.execute({});
  const parentNameMap = new Map(allDepartments.map((dept) => [dept.id, dept.name]));

  // 表示用データに変換（parentId → parentDepartmentName）
  const rows: DepartmentRow[] = departments.map((dept) => ({
    id: dept.id,
    departmentCd: dept.departmentCd,
    name: dept.name,
    abbreviation: dept.abbreviation,
    parentDepartmentName: dept.parentId ? (parentNameMap.get(dept.parentId) ?? "-") : "-",
    isActive: dept.isActive,
  }));

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
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      {/* 一覧表示 */}
      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">部署一覧</h2>
        </div>

        <DataTable columns={columns} data={rows} emptyMessage="部署が登録されていません" />
      </div>
    </div>
  );
}
