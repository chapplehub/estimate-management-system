import { verifySession } from "@/app/_lib/verifyAuthentication";
import { searchEstimateApplicationsQueryFactory } from "@subdomains/estimate/application/factories/estimateQueryFactory";
import { getAllRolesQueryFactory } from "@subdomains/role/application/factories/roleQueryFactory";
import { SEARCHABLE_VARIATION_APPLICATION_STATE_OPTIONS } from "@subdomains/estimate/application/queries/variationApplicationStateOptions";
import type {
  EstimateApplicationSearchCriteria,
  VariationApplicationStateCode,
} from "@subdomains/estimate/application/queries/dto/EstimateApplicationSearchCriteria";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { DataTable } from "@/app/_components/shared/DataTable";
import { columns, type EstimateApplicationRow } from "./_components/columns";
import {
  type SearchParams,
  LIST_FETCH_LIMIT,
  getStringParam,
  getArrayParam,
} from "@/app/_lib/searchParams";
import { fromDateInputValue, toEndOfDayInstant } from "@/app/_lib/date";

export default async function EstimateApplicationListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // 全社台帳の参照。認証のみ（作成導線は持たない読み取り専用一覧）。
  await verifySession();
  const params = await searchParams;

  // 各検索パラメータの生値を一度だけ抽出し、criteria と defaultSearchValues の両方で共有する
  // （キー名の単一ソース化。二重抽出による片側修正漏れを防ぐ）。
  // 申請日レンジ：from は JST 0 時 inclusive、to は JST 当日終端 inclusive（BE の appliedTo ≤ に合わせる）。
  const estimateNumberRaw = getStringParam(params, "estimateNumber");
  const customerNameRaw = getStringParam(params, "customerName");
  const deliveryLocationNameRaw = getStringParam(params, "deliveryLocationName");
  const applicantNameRaw = getStringParam(params, "applicantName");
  const stateRaw = getArrayParam(params, "state");
  const awaitingRoleIdRaw = getStringParam(params, "awaitingRoleId");
  const appliedFromRaw = getStringParam(params, "appliedFrom");
  const appliedToRaw = getStringParam(params, "appliedTo");
  const includeInactive = getStringParam(params, "includeInactive") === "true";

  // 不変事実＝文字列、state＝配列パラメータ、日付＝境界変換、includeInactive＝checkbox。
  // 空文字は getStringParam / getArrayParam が undefined 化し、未指定としてスキップされる。
  const criteria: EstimateApplicationSearchCriteria = {
    estimateNumber: estimateNumberRaw,
    customerName: customerNameRaw,
    deliveryLocationName: deliveryLocationNameRaw,
    applicantName: applicantNameRaw,
    state: stateRaw as VariationApplicationStateCode[] | undefined,
    awaitingRoleId: awaitingRoleIdRaw,
    appliedFrom: appliedFromRaw ? fromDateInputValue(appliedFromRaw) : undefined,
    appliedTo: appliedToRaw ? toEndOfDayInstant(appliedToRaw) : undefined,
    includeInactive,
  };

  // 一覧本体と、承認待ち役割 select の選択肢（全役割）を並列解決する。
  const [applications, roles] = await Promise.all([
    searchEstimateApplicationsQueryFactory().execute(criteria, { limit: LIST_FETCH_LIMIT }),
    getAllRolesQueryFactory().execute({}),
  ]);

  const rows: EstimateApplicationRow[] = applications;

  const searchFields: SearchFieldDef[] = [
    { type: "text", key: "estimateNumber", label: "見積番号", placeholder: "部分一致" },
    { type: "text", key: "customerName", label: "得意先名", placeholder: "部分一致" },
    { type: "text", key: "deliveryLocationName", label: "納品先名", placeholder: "部分一致" },
    { type: "text", key: "applicantName", label: "申請者名", placeholder: "部分一致" },
    {
      type: "multiselect",
      key: "state",
      label: "申請状態",
      options: SEARCHABLE_VARIATION_APPLICATION_STATE_OPTIONS.map((option) => ({
        value: option.code,
        label: option.label,
      })),
      rowBreakBefore: true,
    },
    {
      type: "select",
      key: "awaitingRoleId",
      label: "承認待ち役割",
      options: roles.map((role) => ({ value: role.id, label: role.name })),
    },
    { type: "date", key: "appliedFrom", label: "申請日From" },
    { type: "date", key: "appliedTo", label: "申請日To" },
    { type: "checkbox", key: "includeInactive", label: "無効も含む" },
  ];

  const defaultSearchValues: Record<string, string | string[]> = {
    estimateNumber: estimateNumberRaw ?? "",
    customerName: customerNameRaw ?? "",
    deliveryLocationName: deliveryLocationNameRaw ?? "",
    applicantName: applicantNameRaw ?? "",
    state: stateRaw ?? [],
    awaitingRoleId: awaitingRoleIdRaw ?? "",
    appliedFrom: appliedFromRaw ?? "",
    appliedTo: appliedToRaw ?? "",
    includeInactive: includeInactive ? "true" : "",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">見積申請一覧</h1>
      </div>

      <div className="px-4">
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">申請一覧</h2>
        </div>

        <DataTable columns={columns} data={rows} emptyMessage="該当する見積申請がありません" />
      </div>
    </div>
  );
}
