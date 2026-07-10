import { Money } from "@server/shared/domain/values/Money";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { ResolveCommonSellingPriceQuery } from "./ResolveCommonSellingPriceQuery";
import { ResolveCustomerSellingPriceQuery } from "./ResolveCustomerSellingPriceQuery";
import { ResolveDeliveryLocationSellingPriceQuery } from "./ResolveDeliveryLocationSellingPriceQuery";
import type { SellingPriceResolutionTarget } from "./ResolveSellingPriceQuery";
import { SellingPriceResolutionDTO } from "./dto/SellingPriceResolutionDTO";

/** 2段解決の候補単価（上書き層・共通層それぞれの時点解決結果。該当なしは null）。 */
export type SellingPriceCandidates = {
  override: SellingUnitPrice | null;
  common: SellingUnitPrice | null;
};

/** 2段解決が用いる3層の時点解決ラッパ束。 */
export type SellingPriceLayerQueries = {
  common: ResolveCommonSellingPriceQuery;
  customer: ResolveCustomerSellingPriceQuery;
  deliveryLocation: ResolveDeliveryLocationSellingPriceQuery;
};

/**
 * 見積年月日・提出区分から上書き層・共通層の候補単価を並列に時点解決する（throw/非throw に依らない共通部）。
 *
 * ① 見積年月日(`Date`)→JST 暦日への変換を1度だけ行う（ADR-20260624-95f）。
 * ② 提出区分に応じた上書き層（得意先別 or 納品先別）と共通層を並列に解決する（互いに出力依存が無い）。
 * ③ 時点解決 DTO（10進文字列）→VO（`SellingUnitPrice`）へアプリ層で変換して返す。
 *
 * 「どちらを採るか／解決不能をどう扱うか」の判断は呼び出し側（`resolve`＝throw / `tryResolve`＝非throw）の
 * 責務で、本関数は候補の取得だけを担う。
 */
export async function resolveSellingPriceCandidates(
  target: SellingPriceResolutionTarget,
  queries: SellingPriceLayerQueries
): Promise<SellingPriceCandidates> {
  const date = toJstCalendarDay(target.estimateDate);

  const overridePromise =
    target.addressee === "CUSTOMER"
      ? queries.customer.execute({
          customerId: target.customerId,
          productId: target.productId,
          date,
        })
      : queries.deliveryLocation.execute({
          deliveryLocationId: target.deliveryLocationId,
          productId: target.productId,
          date,
        });

  const commonPromise = queries.common.execute({ productId: target.productId, date });

  const [overrideDto, commonDto] = await Promise.all([overridePromise, commonPromise]);

  return {
    override: toSellingUnitPrice(overrideDto),
    common: toSellingUnitPrice(commonDto),
  };
}

/** 時点解決 DTO（10進文字列）を `SellingUnitPrice` VO へ変換する。null は該当なしとしてそのまま透過。 */
function toSellingUnitPrice(dto: SellingPriceResolutionDTO | null): SellingUnitPrice | null {
  if (dto === null) {
    return null;
  }
  return SellingUnitPrice.fromMoney(Money.fromDecimalString(dto.sellingPrice));
}
