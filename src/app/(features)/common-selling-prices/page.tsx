import { verifySession } from "@/app/_lib/verifyAuthentication";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { DataTable } from "@/app/_components/shared/DataTable";
import { commonSellingPriceListQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import type { CommonSellingPricePriceStatus } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceListItemDTO";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { columns } from "./_components/columns";
import { type SearchParams, getStringParam } from "@/app/_lib/searchParams";

const searchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "商品コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "商品名", placeholder: "部分一致" },
  {
    type: "select",
    key: "filter",
    label: "絞り込み",
    options: [{ value: "unset", label: "未設定のみ" }],
  },
];

/** select値を単価状態の絞り込みへ正規化（未設定のみ=unset、それ以外=指定なし）。 */
function validatePriceStatusFilter(
  value: string | undefined
): CommonSellingPricePriceStatus | undefined {
  return value === "unset" ? "unset" : undefined;
}

export default async function CommonSellingPricePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await verifySession();
  const params = await searchParams;

  const items = await commonSellingPriceListQueryFactory().list({
    referenceDate: toJstCalendarDay(new Date()),
    code: getStringParam(params, "code"),
    name: getStringParam(params, "name"),
    priceStatus: validatePriceStatusFilter(getStringParam(params, "filter")),
  });

  const defaultSearchValues = {
    code: getStringParam(params, "code") ?? "",
    name: getStringParam(params, "name") ?? "",
    filter: getStringParam(params, "filter") ?? "",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">共通売単価</h1>
      </div>

      <div className="px-4">
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">共通売単価一覧</h2>
        </div>

        <DataTable columns={columns} data={items} emptyMessage="該当する商品がありません" />
      </div>
    </div>
  );
}
