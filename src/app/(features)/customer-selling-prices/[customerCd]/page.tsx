import { notFound } from "next/navigation";
import { verifySession } from "@/app/_lib/verifyAuthentication";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { Badge } from "@/app/_components/shadcnui/badge";
import { customerSellingPriceListQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import type { CustomerSellingPricePriceStatus } from "@subdomains/pricing/application/queries/dto/CustomerSellingPriceListDTO";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { type SearchParams, getStringParam } from "@/app/_lib/searchParams";
import { CustomerSelector } from "../_components/CustomerSelector";
import { CustomerSellingPriceTable } from "./_components/CustomerSellingPriceTable";

const searchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "商品コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "商品名", placeholder: "部分一致" },
  {
    type: "select",
    key: "filter",
    label: "絞り込み",
    // none（上書きなし）は正常な既定状態のため、共通一覧の「未設定のみ」2択ではなく3状態の
    // 対称な選択肢にする（すべて=未指定は SearchForm が付与・#506）。
    options: [
      { value: "active", label: "有効" },
      { value: "lapsed", label: "失効中" },
      { value: "none", label: "上書きなし" },
    ],
  },
];

/** select値を単価状態の絞り込みへ正規化（未知値・未指定=絞り込みなし）。 */
function validatePriceStatusFilter(
  value: string | undefined
): CustomerSellingPricePriceStatus | undefined {
  return value === "active" || value === "lapsed" || value === "none" ? value : undefined;
}

/**
 * 得意先別販売単価の一覧画面（#508）。選択得意先の「価格保守対象商品 × 現在有効な得意先別単価」を
 * 一覧化し、共通単価（フォールバック層）を COALESCE せず並記する。
 *
 * 読みモデル（#538）を Server Component から直呼びし、封筒型 DTO の null（得意先不在）は
 * notFound() に写す。無効得意先は弾かずヘッダにバッジで可視化する（セレクタ検索は有効のみの
 * ため直接 URL でのみ到達する＝新規に選ぶ動線には出さないが状況確認は拒まない）。
 */
export default async function CustomerSellingPriceListPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerCd: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await verifySession();
  const { customerCd } = await params;
  const query = await searchParams;

  const result = await customerSellingPriceListQueryFactory().find({
    customerCode: customerCd,
    referenceDate: toJstCalendarDay(new Date()),
    code: getStringParam(query, "code"),
    name: getStringParam(query, "name"),
    priceStatus: validatePriceStatusFilter(getStringParam(query, "filter")),
  });
  if (result == null) {
    notFound();
  }

  const defaultSearchValues = {
    code: getStringParam(query, "code") ?? "",
    name: getStringParam(query, "name") ?? "",
    filter: getStringParam(query, "filter") ?? "",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">得意先別販売単価</h1>
      </div>

      <div className="flex items-center gap-3 mb-2 px-4">
        <span className="text-lg font-semibold text-gray-700">
          {result.customerName}（{result.customerCode}）
        </span>
        {!result.customerIsActive && <Badge variant="outline">無効</Badge>}
        <CustomerSelector label="得意先を変更" />
      </div>

      <div className="px-4">
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">得意先別販売単価一覧</h2>
        </div>

        <CustomerSellingPriceTable customerCode={result.customerCode} items={result.items} />
      </div>
    </div>
  );
}
