import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import { searchProductsQueryFactory } from "@subdomains/product/application/factories/productQueryFactory";
import type { ProductSearchCriteria } from "@subdomains/product/application/queries/dto/ProductSearchCriteria";
import Link from "next/link";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { DataTable } from "@/app/_components/shared/DataTable";
import { columns, type ProductRow } from "./_components/columns";
import { type SearchParams, LIST_FETCH_LIMIT, getStringParam } from "@/app/_lib/searchParams";

function validateIsActive(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

const searchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "商品コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "商品名", placeholder: "部分一致" },
  {
    type: "select",
    key: "category",
    label: "商品区分",
    options: [
      { value: "INDIVIDUAL", label: "個別商品" },
      { value: "CONSUMABLE", label: "消耗品" },
      { value: "SET", label: "セット商品" },
    ],
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

export default async function ProductPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await verifySession();
  const params = await searchParams;

  const criteria: ProductSearchCriteria = {
    code: getStringParam(params, "code"),
    name: getStringParam(params, "name"),
    category: getStringParam(params, "category"),
    isActive: validateIsActive(getStringParam(params, "isActive")),
  };

  const searchQuery = searchProductsQueryFactory();
  const products = await searchQuery.execute(criteria, {
    limit: LIST_FETCH_LIMIT,
    orderBy: { field: "code", direction: "asc" },
  });

  const rows: ProductRow[] = products.map((product) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    category: product.category,
    unit: product.unit,
    isActive: product.isActive,
  }));

  const defaultSearchValues = {
    code: getStringParam(params, "code") ?? "",
    name: getStringParam(params, "name") ?? "",
    category: getStringParam(params, "category") ?? "",
    isActive: getStringParam(params, "isActive") ?? "",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">商品管理</h1>
        {isAdmin(session) && (
          <Link
            href="/products/new"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            新規登録
          </Link>
        )}
      </div>

      <div className="px-4">
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">商品一覧</h2>
        </div>

        <DataTable columns={columns} data={rows} emptyMessage="商品が登録されていません" />
      </div>
    </div>
  );
}
