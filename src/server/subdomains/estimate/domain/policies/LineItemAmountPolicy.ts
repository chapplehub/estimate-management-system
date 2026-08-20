import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { DiscountRate } from "../values/DiscountRate";
import type { Money } from "@server/shared/domain/values/Money";
import type { Quantity } from "../values/Quantity";

/**
 * 明細レベル金額計算の結果（設計書 §8.1 (1)-(3)）。
 *
 * EstimateItem テーブルは baseAmount / discountedAmount / finalAmount を別カラムで
 * 保持するため、ポリシーは最終金額だけでなく中間値も返す。
 */
export type LineItemAmountResult = {
  /** §8.1(1) 基本金額 = 数量 × 単価（円未満切捨） */
  baseAmount: Money;
  /** §8.1(2) 掛率適用後金額 = 基本金額 × 掛率（円未満切捨） */
  discountedAmount: Money;
  /** §8.1(3) 最終明細金額 = 掛率適用後金額 − 明細値引金額 */
  finalAmount: Money;
};

/**
 * 明細レベル金額計算ポリシー（設計書 §8.1 (1)-(3)）。
 *
 * 計算規約を独立した名前付きクラスとして扱う Policy パターン。Entity 着手時は
 * EstimateItem からこの calculate を委譲呼び出しする想定。
 *
 * 端数処理は Money の 2 段階チェーンで表現する:
 *   ① applyRate 内の銭未満切捨（割り算を含む比率計算）
 *   ② truncateToMajorUnit による円未満切捨（§8.1 「端数切捨」）
 */
export class LineItemAmountPolicy {
  private constructor() {}

  static calculate(
    unitPrice: Money,
    quantity: Quantity,
    discountRate: DiscountRate,
    itemDiscount: Money
  ): LineItemAmountResult {
    const baseAmount = unitPrice.times(quantity.value).truncateToMajorUnit();
    const discountedAmount = baseAmount
      .applyRate(discountRate.numerator, DiscountRate.SCALE)
      .truncateToMajorUnit();
    const finalAmount = discountedAmount.subtract(itemDiscount);

    if (finalAmount.isNegative()) {
      throw new BusinessRuleViolationError("値引き後の金額がマイナスになります");
    }

    return { baseAmount, discountedAmount, finalAmount };
  }
}
