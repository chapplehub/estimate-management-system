import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import { USER_ROLES, type UserRole } from "@server/shared/auth/types";
import { SearchEmployeesQuery } from "@subdomains/employee/application/queries/SearchEmployeesQuery";
import type { EmployeeSearchCriteria } from "@subdomains/employee/application/queries/dto/EmployeeSearchCriteria";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import Link from "next/link";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { DataTable } from "@/app/_components/shared/DataTable";
import { columns } from "./_components/columns";
import { type SearchParams, LIST_FETCH_LIMIT, getStringParam } from "@/app/_lib/searchParams";

// NOTE: このページの検索機能の実装としては、URLのパスパラメタに基づいて検索を実行する。そのため初期検索は全件取得。
// NOTE: 検索条件を入力して検索ボタンを押すと直接検索APIが実行されるのではなく、まず入力した検索条件をパスパラメタに設定してナビゲーションし、レンダリング時に検索処理が実行される。

// ヘルパー関数: role値を検証
function validateRole(value: string | undefined): UserRole | undefined {
  if (value === USER_ROLES.ADMIN || value === USER_ROLES.USER) {
    return value;
  }
  return undefined;
}

// 検索フォームのフィールド定義
const searchFields: SearchFieldDef[] = [
  { type: "text", key: "name", label: "名前", placeholder: "部分一致" },
  { type: "text", key: "employeeCd", label: "従業員コード", placeholder: "完全一致" },
  { type: "text", key: "email", label: "メールアドレス", placeholder: "部分一致" },
  {
    type: "select",
    key: "role",
    label: "権限",
    options: [
      { value: USER_ROLES.USER, label: "一般ユーザー" },
      { value: USER_ROLES.ADMIN, label: "管理者" },
    ],
  },
];

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

  // 検索実行（最大 LIST_FETCH_LIMIT 件を一括取得）
  const queryService = new PrismaEmployeeQueryService();
  const searchQuery = new SearchEmployeesQuery(queryService);
  const employees = await searchQuery.execute({
    criteria,
    options: { limit: LIST_FETCH_LIMIT },
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
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      {/* 一覧表示 */}
      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">従業員一覧</h2>
        </div>

        <DataTable columns={columns} data={employees} emptyMessage="従業員が登録されていません" />
      </div>
    </div>
  );
}
