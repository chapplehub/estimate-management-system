import { DataTable } from "@/app/_components/shared/DataTable";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { LIST_FETCH_LIMIT, getStringParam, type SearchParams } from "@/app/_lib/searchParams";
import { verifySession } from "@/app/_lib/verifyAuthentication";
import { searchCustomersQueryFactory } from "@subdomains/customer/application/factories";
import { searchDeliveryLocationsQueryFactory } from "@subdomains/delivery-location/application/factories";
import type { DeliveryLocationSearchCriteria } from "@subdomains/delivery-location/application/queries/dto/DeliveryLocationSearchCriteria";
import { columns } from "./_components/columns";

function parseIsActive(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function buildSearchFields(customerOptions: { value: string; label: string }[]): SearchFieldDef[] {
  return [
    {
      type: "text",
      key: "name",
      label: "名前",
      placeholder: "部分一致",
      className: "flex-[2] min-w-[200px]",
    },
    {
      type: "text",
      key: "code",
      label: "コード",
      placeholder: "完全一致",
      className: "flex-none w-[100px]",
    },
    {
      type: "select",
      key: "customerId",
      label: "得意先",
      options: customerOptions,
    },
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
}

export default async function DeliveryLocationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await verifySession();
  const params = await searchParams;

  // 得意先データの取得（ドロップダウン選択肢用）
  const searchCustomersQuery = searchCustomersQueryFactory();
  const customers = await searchCustomersQuery.execute(
    { isActive: true },
    { orderBy: { field: "code", direction: "asc" } }
  );
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));

  // 検索条件の構築
  const criteria: DeliveryLocationSearchCriteria = {
    name: getStringParam(params, "name"),
    code: getStringParam(params, "code"),
    customerId: getStringParam(params, "customerId"),
    isActive: parseIsActive(getStringParam(params, "isActive")),
  };

  // 検索実行
  const searchQuery = searchDeliveryLocationsQueryFactory();
  const deliveryLocations = await searchQuery.execute(criteria, {
    limit: LIST_FETCH_LIMIT,
    orderBy: { field: "code", direction: "asc" },
  });

  // 検索フォームのフィールド定義
  const searchFields = buildSearchFields(customerOptions);
  const searchFieldKeys = searchFields.map((f) => f.key);

  // Client Componentに渡すdefaultValues
  const defaultSearchValues: Record<string, string> = {};
  for (const key of searchFieldKeys) {
    defaultSearchValues[key] = getStringParam(params, key) ?? "";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">納品先管理</h1>
      </div>

      <div className="px-4">
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">納品先一覧</h2>
        </div>

        <DataTable
          columns={columns}
          data={deliveryLocations}
          emptyMessage="納品先が登録されていません"
        />
      </div>
    </div>
  );
}
