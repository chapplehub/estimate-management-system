import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ApprovalGoalTier } from "../../values/approval/ApprovalGoalTier";
import { EstimateExemptionReason } from "../../values/approval/EstimateExemptionReason";
import { EstimateType } from "../../values/EstimateType";
import { Money } from "../../values/Money";

/**
 * 承認要否の判定結果（§4・ADR-0062）
 *
 * 免除（理由付き）か、承認必要（抽象ゴール段階付き）かの判別共用体。`REQUIRED` は具体役職
 * （`Position`）の identity を持たず、抽象的な {@link ApprovalGoalTier} のみを返す。具体役職
 * への解決は `ApprovalChainBuilder`（§5）が組織スナップショットで行う（ADR-0062）。
 */
export type ApprovalRequirement =
  | { readonly kind: "EXEMPT"; readonly reason: EstimateExemptionReason }
  | { readonly kind: "REQUIRED"; readonly goalTier: ApprovalGoalTier };

/**
 * 承認要否判定ポリシー（§4・ADR-0004/0023/0055/0062）
 *
 * 副作用のない純関数。バリエーションのスナップショット属性（金額・末端明細の商品区分・
 * 見積区分）を引数で受け取り（ADR-0030）、免除か承認必要かを判定する。永続化を伴わないため
 * 画面表示・申請プレビュー・申請実行のいずれからも呼べる。
 *
 * 金額閾値（10万/100万/1000万/3000万・税込）は業務ルールとしてドメイン（本ポリシー）に
 * 保持する。返すゴールは抽象段階（{@link ApprovalGoalTier}）であり、`Position` の identity を
 * 知らない（ADR-0062）。
 */
export class ApprovalRequirementPolicy {
  private constructor() {}

  /**
   * 承認要否を判定する（§4.2 の評価順）。
   *
   * 1. 事後見積 → AFTER_REPAIR で免除
   * 2. 価格を持つ末端明細がすべて消耗品 → CONSUMABLE_ONLY で免除（金額無関係・ADR-0004）
   * 3. 税込合計が10万円未満 → BELOW_THRESHOLD で免除
   * 4. 承認必要 → 金額段階からゴール段階を決定（10万=課長／100万=部長／1000万=本部長／3000万=社長）
   */
  static judge(input: {
    finalTotal: Money;
    leafCategories: ProductCategory[];
    estimateType: EstimateType;
  }): ApprovalRequirement {
    if (input.estimateType.equals(EstimateType.AFTER_REPAIR)) {
      return { kind: "EXEMPT", reason: EstimateExemptionReason.AFTER_REPAIR };
    }
    if (ApprovalRequirementPolicy.isConsumableOnly(input.leafCategories)) {
      return { kind: "EXEMPT", reason: EstimateExemptionReason.CONSUMABLE_ONLY };
    }
    if (!input.finalTotal.isAtLeast(Money.fromMajorUnits(100_000))) {
      return { kind: "EXEMPT", reason: EstimateExemptionReason.BELOW_THRESHOLD };
    }
    return { kind: "REQUIRED", goalTier: ApprovalRequirementPolicy.goalTierOf(input.finalTotal) };
  }

  /**
   * 価格を持つ末端明細の区分がすべて消耗品か（§4.2）。区分が空の場合は「消耗品のみ」とは
   * みなさない（価格付き明細が無い見積を免除に倒さない防御）。
   */
  private static isConsumableOnly(leafCategories: ProductCategory[]): boolean {
    return (
      leafCategories.length > 0 &&
      leafCategories.every((category) => category.equals(ProductCategory.CONSUMABLE))
    );
  }

  /** 金額段階からゴール段階を決定する（§4.2・税込・ADR-0055）。 */
  private static goalTierOf(finalTotal: Money): ApprovalGoalTier {
    if (finalTotal.isAtLeast(Money.fromMajorUnits(30_000_000))) {
      return ApprovalGoalTier.PRESIDENT;
    }
    if (finalTotal.isAtLeast(Money.fromMajorUnits(10_000_000))) {
      return ApprovalGoalTier.DIVISION_MANAGER;
    }
    if (finalTotal.isAtLeast(Money.fromMajorUnits(1_000_000))) {
      return ApprovalGoalTier.DEPARTMENT_MANAGER;
    }
    return ApprovalGoalTier.SECTION_MANAGER;
  }
}
