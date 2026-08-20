import { verifySession } from "@/app/_lib/verifyAuthentication";
import { searchEstimatesQueryFactory } from "@subdomains/estimate/application/factories/estimateQueryFactory";
import type { EstimateSearchCriteria } from "@subdomains/estimate/application/queries/dto/EstimateSearchCriteria";
import Link from "next/link";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { DataTable } from "@/app/_components/shared/DataTable";
import { columns, type EstimateRow } from "./_components/columns";
import { type SearchParams, LIST_FETCH_LIMIT, getStringParam } from "@/app/_lib/searchParams";

const searchFields: SearchFieldDef[] = [
  { type: "text", key: "estimateNumber", label: "見積番号", placeholder: "部分一致" },
  { type: "text", key: "customerName", label: "得意先名", placeholder: "部分一致" },
  {
    type: "select",
    key: "estimateType",
    label: "区分",
    options: [
      { value: "NEW", label: "新規" },
      { value: "REPAIR", label: "修理" },
      { value: "AFTER_REPAIR", label: "事後" },
    ],
  },
  {
    type: "select",
    key: "activeStatus",
    label: "有効/無効",
    options: [
      { value: "ACTIVE", label: "有効" },
      { value: "INACTIVE", label: "無効" },
    ],
  },
];

export default async function EstimateListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // 認証のみ。新規登録ボタンは isAdmin ゲートを付けず全員表示（Q5）。
  await verifySession();
  const params = await searchParams;

  // 空文字は getStringParam が undefined 化し、buildWhereClause が未指定としてスキップする（Q3）。
  const criteria: EstimateSearchCriteria = {
    estimateNumber: getStringParam(params, "estimateNumber"),
    customerName: getStringParam(params, "customerName"),
    estimateType: getStringParam(params, "estimateType"),
    activeStatus: getStringParam(params, "activeStatus"),
  };

  // orderBy は渡さず BE 既定 [deadline asc, createdAt asc, estimateNumber asc] に委ねる（Q4）。
  const searchQuery = searchEstimatesQueryFactory();
  const estimates = await searchQuery.execute(criteria, { limit: LIST_FETCH_LIMIT });

  const rows: EstimateRow[] = estimates.map((estimate) => ({
    estimateId: estimate.estimateId,
    estimateNumber: estimate.estimateNumber,
    estimateType: estimate.estimateType,
    customerName: estimate.customerName,
    deliveryLocationName: estimate.deliveryLocationName,
    creatorName: estimate.creatorName,
    deadline: estimate.deadline,
    finalTotal: estimate.finalTotal,
    activeStatus: estimate.activeStatus,
  }));

  const defaultSearchValues = {
    estimateNumber: getStringParam(params, "estimateNumber") ?? "",
    customerName: getStringParam(params, "customerName") ?? "",
    estimateType: getStringParam(params, "estimateType") ?? "",
    activeStatus: getStringParam(params, "activeStatus") ?? "",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">見積管理</h1>
        {/* 見積はトランザクションデータで担当者の日常業務のため isAdmin ゲートを付けない（Q5）。 */}
        <Link
          href="/estimates/new"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          新規登録
        </Link>
      </div>

      <div className="px-4">
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">見積一覧</h2>
        </div>

        <DataTable columns={columns} data={rows} emptyMessage="見積が登録されていません" />
      </div>
    </div>
  );
}
