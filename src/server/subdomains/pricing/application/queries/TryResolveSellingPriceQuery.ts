import {
  PriceResolutionPolicy,
  type PriceResolutionOutcome,
} from "@subdomains/pricing/domain/policies/PriceResolutionPolicy";
import { ResolveCommonSellingPriceQuery } from "./ResolveCommonSellingPriceQuery";
import { ResolveCustomerSellingPriceQuery } from "./ResolveCustomerSellingPriceQuery";
import { ResolveDeliveryLocationSellingPriceQuery } from "./ResolveDeliveryLocationSellingPriceQuery";
import type { SellingPriceResolutionTarget } from "./ResolveSellingPriceQuery";
import { resolveSellingPriceCandidates } from "./resolveSellingPriceCandidates";

/**
 * 見積年月日・提出区分から見積単価を非 throw で解決する読み取り契機のオーケストレーション（#593）。
 *
 * {@link ResolveSellingPriceQuery} の兄弟。候補取得（暦日変換・2層並列解決）は
 * {@link resolveSellingPriceCandidates} で共有し、解決不能を throw ではなく `UNRESOLVABLE` として返す
 * （単価乖離・解決不能の可視化は表示のたびに再解決する派生状態・ADR-20260710-fg7）。
 * 書き込み契機の拒否は従来どおり throw 版 {@link ResolveSellingPriceQuery} を使う。
 */
export class TryResolveSellingPriceQuery {
  constructor(
    private readonly commonQuery: ResolveCommonSellingPriceQuery,
    private readonly customerQuery: ResolveCustomerSellingPriceQuery,
    private readonly deliveryLocationQuery: ResolveDeliveryLocationSellingPriceQuery
  ) {}

  async execute(target: SellingPriceResolutionTarget): Promise<PriceResolutionOutcome> {
    const candidates = await resolveSellingPriceCandidates(target, {
      common: this.commonQuery,
      customer: this.customerQuery,
      deliveryLocation: this.deliveryLocationQuery,
    });

    return PriceResolutionPolicy.tryResolve(candidates);
  }
}
