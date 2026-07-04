import { notFound } from "next/navigation";
import { verifySession } from "@/app/_lib/verifyAuthentication";
import { SearchForm, type SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { Badge } from "@/app/_components/shadcnui/badge";
import { deliveryLocationSellingPriceListQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import type { DeliveryLocationSellingPricePriceStatus } from "@subdomains/pricing/application/queries/dto/DeliveryLocationSellingPriceListDTO";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { type SearchParams, getStringParam } from "@/app/_lib/searchParams";
import { DeliveryLocationSelector } from "../_components/DeliveryLocationSelector";
import { DeliveryLocationSellingPriceTable } from "./_components/DeliveryLocationSellingPriceTable";

const searchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "商品コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "商品名", placeholder: "部分一致" },
  {
    type: "select",
    key: "filter",
    label: "絞り込み",
    // none（上書きなし）は正常な既定状態のため、共通一覧の「未設定のみ」2択ではなく3状態の
    // 対称な選択肢にする（すべて=未指定は SearchForm が付与・#546）。
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
): DeliveryLocationSellingPricePriceStatus | undefined {
  return value === "active" || value === "lapsed" || value === "none" ? value : undefined;
}

/**
 * 納品先別販売単価の一覧画面（#548）。選択納品先の「価格保守対象商品 × 現在有効な納品先別単価」を
 * 一覧化し、共通単価（フォールバック層）を COALESCE せず並記する（納品先宛の価格解決連鎖 `納品先別 ??
 * 共通` で得意先別は連鎖外・並記は共通のみ）。
 *
 * 読みモデル（#546）を Server Component から直呼びし、封筒型 DTO の null（納品先不在）は notFound() に
 * 写す。封筒が同梱する親得意先 identity をヘッダに併記する（納品先は親得意先の文脈が無いと保守画面
 * ヘッダで意味を成さない）。無効納品先は弾かずヘッダにバッジで可視化する（セレクタ検索は有効のみの
 * ため直接 URL でのみ到達する＝新規に選ぶ動線には出さないが状況確認は拒まない）。
 */
export default async function DeliveryLocationSellingPriceListPage({
  params,
  searchParams,
}: {
  params: Promise<{ deliveryLocationCd: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await verifySession();
  const { deliveryLocationCd } = await params;
  const query = await searchParams;

  const result = await deliveryLocationSellingPriceListQueryFactory().find({
    deliveryLocationCode: deliveryLocationCd,
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
        <h1 className="text-3xl font-bold">納品先別販売単価</h1>
      </div>

      <div className="flex items-center gap-3 mb-2 px-4">
        <span className="text-lg font-semibold text-gray-700">
          {result.deliveryLocationName}（{result.deliveryLocationCode}）
        </span>
        {!result.deliveryLocationIsActive && <Badge variant="outline">無効</Badge>}
        <span className="text-sm text-gray-500">
          {result.customerName}（{result.customerCode}）
        </span>
        <DeliveryLocationSelector label="納品先を変更" />
      </div>

      <div className="px-4">
        <SearchForm fields={searchFields} defaultValues={defaultSearchValues} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-md rounded mx-4 mb-4 text-gray-500">
        <div className="px-8 pt-6 pb-2">
          <h2 className="text-xl font-semibold">納品先別販売単価一覧</h2>
        </div>

        <DeliveryLocationSellingPriceTable
          deliveryLocationCode={result.deliveryLocationCode}
          items={result.items}
        />
      </div>
    </div>
  );
}
