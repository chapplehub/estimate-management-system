import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Money } from "@server/shared/domain/values/Money";
import { TaxRate } from "../values/TaxRate";
import type { TaxRoundingType } from "../values/TaxRoundingType";

/**
 * 見積レベル金額計算の入力（設計書 §8.1 (4)-(7)）。
 *
 * 引数が 4 つあり、それぞれ意味が並列なので、オブジェクト引数にして
 * 呼び出し側でフィールド名を明示できるようにする。
 */
export type EstimateAmountInput = {
  /** §8.1(3) の結果列（各明細の最終明細金額） */
  finalLineAmounts: Money[];
  /** 全体値引金額 */
  overallDiscount: Money;
  /** 消費税率 */
  taxRate: TaxRate;
  /** 消費税額の端数処理区分（§8.3） */
  taxRoundingType: TaxRoundingType;
};

/**
 * 見積レベル金額計算の結果（設計書 §8.1 (4)-(7)）。
 *
 * EstimateVariation テーブルが subtotal / discountSubtotal / finalSubtotal /
 * taxAmount / finalTotal を別カラムで保持するため、ポリシーは中間値も返す。
 * （本実装では「明細値引小計」は明細側で算出される値なので入力に持ち込まず、
 *   見積レベルとしての小計＝Σ(最終明細) のみを返す。）
 */
export type EstimateAmountResult = {
  /** §8.1(4) 最終明細金額小計 = Σ(最終明細金額) */
  subtotal: Money;
  /** §8.1(5) 全体値引後金額 = 小計 − 全体値引金額 */
  afterOverallDiscount: Money;
  /** §8.1(6) 消費税額 = 全体値引後金額 × 税率（区分丸め） */
  taxAmount: Money;
  /** §8.1(7) 最終合計金額 = 全体値引後金額 + 消費税額 */
  finalTotal: Money;
};

/**
 * 見積レベル金額計算ポリシー（設計書 §8.1 (4)-(7)）。
 *
 * 端数処理は 2 段階チェーン:
 *   ① applyRate 内の銭未満切捨（税率の比率計算）
 *   ② taxRoundingType.applyTo による円単位の選択式丸め（§8.3）
 */
export class EstimateAmountPolicy {
  private constructor() {}

  static calculate(input: EstimateAmountInput): EstimateAmountResult {
    const subtotal = input.finalLineAmounts.reduce((acc, amount) => acc.add(amount), Money.zero());
    const afterOverallDiscount = subtotal.subtract(input.overallDiscount);

    if (afterOverallDiscount.isNegative()) {
      throw new BusinessRuleViolationError("値引き後の金額がマイナスになります");
    }

    const rawTax = afterOverallDiscount.applyRate(input.taxRate.numerator, TaxRate.SCALE);
    const taxAmount = input.taxRoundingType.applyTo(rawTax);
    const finalTotal = afterOverallDiscount.add(taxAmount);

    return { subtotal, afterOverallDiscount, taxAmount, finalTotal };
  }
}
