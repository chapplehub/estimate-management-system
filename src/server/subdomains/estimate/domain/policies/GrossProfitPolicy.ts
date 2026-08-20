import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import type { Money } from "@server/shared/domain/values/Money";

/**
 * 粗利計算の結果（設計書 §8.4、得意先向け見積）。
 *
 * 粗利率は金額ではなく比率 (dimensionless) なので Money ではなく number で持つ。
 * 表示時のパーセント変換・桁丸め（設計書例「16.7%」）は presentation 層の責務。
 */
export type GrossProfitResult = {
  /** 粗利 = 納品先価格 − 得意先価格（負を許容: 逆ザヤ） */
  grossProfit: Money;
  /** 粗利率 = 粗利 / 納品先価格（0..1 の比率、負値もありうる） */
  grossProfitRate: number;
};

/**
 * 粗利計算ポリシー（設計書 §8.4）。
 *
 * 対象は見積バリエーション全体の比較（納品先向け最終合計 vs 得意先向け最終合計）。
 * 明細単位の粗利（RevisedEstimateItemDetail.deliveryPrice のスナップショットを
 * 使う形）は本ポリシーでは扱わない。
 *
 * 粗利が負になる「逆ザヤ」は業務上ありえる（特売・販促等）ため、設計書 §8.4 に
 * 禁止記述もなく、ここではエラーにせず Money の負値として返す。
 *
 * 一方、納品先価格 = 0 のときは粗利率がゼロ除算になるため、防御的に throw する。
 */
export class GrossProfitPolicy {
  private constructor() {}

  static calculate(deliveryPrice: Money, customerPrice: Money): GrossProfitResult {
    if (deliveryPrice.isZero()) {
      throw new BusinessRuleViolationError("納品先価格が0の場合、粗利率を計算できません");
    }

    const grossProfit = deliveryPrice.subtract(customerPrice);
    const grossProfitRate = grossProfit.minorUnits / deliveryPrice.minorUnits;

    return { grossProfit, grossProfitRate };
  }
}
