import Link from "next/link";
import type { CommonSellingPricePriceStatus } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceListItemDTO";

/**
 * 共通販売単価 未設定/失効の設定誘導バナー（#487・商品側起点のソフトなアナウンス）。
 *
 * 有効かつ価格を持ちうる商品で現在有効な単価が無い（`unset`／`lapsed`）ときに、操作をブロックせず
 * 共通販売単価 設定画面（`/common-selling-prices/[productCd]`）への導線を常設表示する。表示するか否か
 * （`isActive` かつ `canHavePrice`）の判定は呼び出し側（詳細ページ）の責務。ここでは受け取った状態が
 * `active` なら描画しない（防御的）。
 */
export function CommonSellingPriceUnsetBanner({
  priceStatus,
  productCode,
}: {
  priceStatus: CommonSellingPricePriceStatus;
  productCode: string;
}) {
  if (priceStatus === "active") {
    return null;
  }

  const message =
    priceStatus === "unset"
      ? "この商品には共通販売単価が未設定です。見積で使用する前に設定してください。"
      : "この商品には現在有効な共通販売単価がありません（失効中）。見積で使用する前に設定してください。";

  return (
    <div
      role="alert"
      className="mb-8 rounded border border-amber-300 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium">{message}</p>
        <Link
          href={`/common-selling-prices/${productCode}`}
          className="shrink-0 font-bold text-amber-900 underline hover:text-amber-700"
        >
          共通販売単価を設定 →
        </Link>
      </div>
    </div>
  );
}
