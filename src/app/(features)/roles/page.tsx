import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import { searchRolesQueryFactory } from "@subdomains/role/application/factories";
import { getAllPositionsQueryFactory } from "@subdomains/position/application/factories";
import type { RoleSearchCriteria } from "@subdomains/role/application/queries/dto/RoleSearchCriteria";
import Link from "next/link";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { DataTable } from "@/app/_components/shared/DataTable";
import { columns, type RoleRow } from "./_components/columns";
import { type SearchParams, LIST_FETCH_LIMIT, getStringParam } from "@/app/_lib/searchParams";

export default async function RolePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await verifySession();
  const params = await searchParams;

  // 役職データの取得（検索フォームのセレクト用）
  const getAllPositionsQuery = getAllPositionsQueryFactory();
  const positions = await getAllPositionsQuery.execute();

  // 検索条件の構築
  const criteria: RoleSearchCriteria = {
    name: getStringParam(params, "name"),
    roleCd: getStringParam(params, "roleCd"),
    positionId: getStringParam(params, "positionId"),
  };

  // 検索実行
  const searchQuery = searchRolesQueryFactory();
  const roles = await searchQuery.execute({
    criteria,
    options: { limit: LIST_FETCH_LIMIT, orderBy: { field: "roleCd", direction: "asc" } },
  });

  // 表示用データに変換
  const rows: RoleRow[] = roles.map((role) => ({
    id: role.id,
    roleCd: role.roleCd,
    name: role.name,
    positionName: role.positionName,
    superiorRoleName: role.superiorRoleName ?? "-",
  }));

  // 検索フォームのフィールド定義
  const searchFields: SearchFieldDef[] = [
    { type: "text", key: "name", label: "役割名", placeholder: "部分一致" },
    { type: "text", key: "roleCd", label: "役割コード", placeholder: "完全一致" },
    {
      type: "select",
      key: "positionId",
      label: "役職",
      options: positions.map((p) => ({ value: p.id, label: p.name })),
    },
  ];

  // Client Componentに渡すdefaultValues
  const defaultSearchValues = {
    name: getStringParam(params, "name") ?? "",
    roleCd: getStringParam(params, "roleCd") ?? "",
    positionId: getStringParam(params, "positionId") ?? "",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">役割管理</h1>
        {isAdmin(session) && (
          <Link
            href="/roles/new"
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
          <h2 className="text-xl font-semibold">役割一覧</h2>
        </div>

        <DataTable columns={columns} data={rows} emptyMessage="役割が登録されていません" />
      </div>
    </div>
  );
}
