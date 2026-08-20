"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { fromDateInputValue } from "@/app/_lib/date";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { resolveSellingPriceQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import {
  type SellingPriceResolutionTarget,
  type ResolveSellingPriceQuery,
} from "@subdomains/pricing/application/queries/ResolveSellingPriceQuery";

/** 表示用ライブ解決の宛先種別（`SellingPriceResolutionTarget` の判別子と一致）。 */
export type SellingPriceAddressee = "CUSTOMER" | "DELIVERY_LOCATION";

/** 表示用販売単価解決のバッチ入力。 */
export type ResolveSellingPricesInput = {
  /** 見積年月日（"yyyy-mm-dd"）。JST 固定でパースする。 */
  estimateDate: string;
  addressee: SellingPriceAddressee;
  /** 提出区分に対応する宛先ID（得意先ID or 納品先ID）。 */
  addresseeId: string;
  productIds: readonly string[];
};

/** productId → 見積単価（円・整数 majorUnits）。解決不能は null。 */
export type ResolvedSellingPrices = Record<string, number | null>;

/**
 * 明細編集フォームの商品選択・セット展開時に、見積単価をマスタからライブ解決する Server Action（#430）。
 *
 * 保存時の権威解決（`resolveLinePrices`）とは責務が異なり、**解決不能を throw せず null で返す**。
 * FE は null を「販売単価未設定」として扱い、行を追加せずエラー表示する（ADR-0064）。確定値は submit 時に
 * サーバーが権威解決する（クライアント値は一切受け取らない）。日付は JST 固定でパースし暦日ずれを避ける
 * （`tax-rate-actions.ts` 前例踏襲）。同一商品IDはデデュープし1回だけ解決する。
 */
export async function resolveSellingPricesForDisplay(
  input: ResolveSellingPricesInput
): Promise<ResolvedSellingPrices> {
  await verifySession();

  const { estimateDate, addressee, addresseeId, productIds } = input;
  if (!estimateDate || productIds.length === 0) {
    return {};
  }

  const date = fromDateInputValue(estimateDate);
  const resolver = resolveSellingPriceQueryFactory();
  const uniqueProductIds = [...new Set(productIds)];

  const entries = await Promise.all(
    uniqueProductIds.map(
      async (productId) =>
        [
          productId,
          await resolveOrNull(resolver, toTarget(productId, addressee, addresseeId, date)),
        ] as const
    )
  );

  return Object.fromEntries(entries);
}

/** 解決不能（`BusinessRuleViolationError`）のみ null に倒し、その他の例外はそのまま伝播する。 */
async function resolveOrNull(
  resolver: Pick<ResolveSellingPriceQuery, "execute">,
  target: SellingPriceResolutionTarget
): Promise<number | null> {
  try {
    const price = await resolver.execute(target);
    return price.majorUnits;
  } catch (error) {
    if (error instanceof BusinessRuleViolationError) {
      return null;
    }
    throw error;
  }
}

/** 商品ID＋宛先を、提出区分に応じた価格決定ターゲットへマップする。 */
function toTarget(
  productId: string,
  addressee: SellingPriceAddressee,
  addresseeId: string,
  estimateDate: Date
): SellingPriceResolutionTarget {
  if (addressee === "DELIVERY_LOCATION") {
    return {
      addressee: "DELIVERY_LOCATION",
      deliveryLocationId: addresseeId,
      productId,
      estimateDate,
    };
  }
  return { addressee: "CUSTOMER", customerId: addresseeId, productId, estimateDate };
}
