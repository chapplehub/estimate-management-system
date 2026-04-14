import { DataTable } from "@/app/_components/shared/DataTable";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { LIST_FETCH_LIMIT, getStringParam, type SearchParams } from "@/app/_lib/searchParams";
import { verifySession } from "@/app/_lib/verifyAuthentication";
import { PREFECTURES } from "@server/shared/domain/values/Prefecture";
import { searchCustomersQueryFactory } from "@subdomains/customer/application/factories";
import type { CustomerSearchCriteria } from "@subdomains/customer/application/queries/dto/CustomerSearchCriteria";
import { columns } from "./_components/columns";

function parseIsActive(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

const prefectureOptions = PREFECTURES.map((p) => ({ value: p, label: p }));

const searchFields: SearchFieldDef[] = [
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
    type: "text",
    key: "postalCode",
    label: "郵便番号",
    placeholder: "完全一致",
    className: "flex-1 min-w-[100px]",
  },
  {
    type: "select",
    key: "prefecture",
    label: "都道府県",
    options: prefectureOptions,
  },
  {
    type: "text",
    key: "address",
    label: "住所",
    placeholder: "部分一致",
    className: "flex-[999] min-w-[100px]",
  },
  {
    type: "text",
    key: "phoneNumber",
    label: "電話番号",
    placeholder: "完全一致",
    className: "flex-none w-[160px]",
    rowBreakBefore: true,
  },
  {
    type: "text",
    key: "faxNumber",
    label: "FAX番号",
    placeholder: "完全一致",
    className: "flex-none w-[160px]",
  },
  {
    type: "text",
    key: "contactPerson",
    label: "担当者",
    placeholder: "部分一致",
    className: "flex-none w-[200px]",
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

const searchFieldKeys = searchFields.map((f) => f.key);

export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await verifySession();
  const params = await searchParams;

  const criteria: CustomerSearchCriteria = {
    name: getStringParam(params, "name"),
    code: getStringParam(params, "code"),
    postalCode: getStringParam(params, "postalCode"),
    prefecture: getStringParam(params, "prefecture"),
    address: getStringParam(params, "address"),
    phoneNumber: getStringParam(params, "phoneNumber"),
    faxNumber: getStringParam(params, "faxNumber"),
    contactPerson: getStringParam(params, "contactPerson"),
    isActive: parseIsActive(getStringParam(params, "isActive")),
  };

  const searchQuery = searchCustomersQueryFactory();
  const customers = await searchQuery.execute(criteria, {
    limit: LIST_FETCH_LIMIT,
    orderBy: { field: "code", direction: "asc" },
  });

  const defaultSearchValues: Record<string, string> = {};
  for (const key of searchFieldKeys) {
    defaultSearchValues[key] = getStringParam(params, key) ?? "";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">得意先管理</h1>
      </div>

      <div className="px-4">
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">得意先一覧</h2>
        </div>

        <DataTable columns={columns} data={customers} emptyMessage="得意先が登録されていません" />
      </div>
    </div>
  );
}
