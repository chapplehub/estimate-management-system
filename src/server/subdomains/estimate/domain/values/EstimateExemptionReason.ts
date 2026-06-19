import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = ["CONSUMABLE_ONLY", "BELOW_THRESHOLD", "AFTER_REPAIR"] as const;
type EstimateExemptionReasonValue = (typeof VALID_VALUES)[number];

const LABEL_MAP: Record<EstimateExemptionReasonValue, string> = {
  CONSUMABLE_ONLY: "消耗品のみ",
  BELOW_THRESHOLD: "10万円未満",
  AFTER_REPAIR: "事後見積",
};

/**
 * 承認免除理由の値オブジェクト
 *
 * Prisma の `EstimateExemptionReason` enum と 1:1 対応（§3.1）。
 * 承認要否ポリシー（§4.2）が免除と判定したときの理由を表す。
 *
 * CONSUMABLE_ONLY: 消耗品のみ（金額無関係・ADR-0004）
 * BELOW_THRESHOLD: 10万円未満
 * AFTER_REPAIR: 事後見積（作業済みのため・§6.3）
 */
export class EstimateExemptionReason extends ValueObject<string, "EstimateExemptionReason"> {
  static readonly CONSUMABLE_ONLY = new EstimateExemptionReason("CONSUMABLE_ONLY");
  static readonly BELOW_THRESHOLD = new EstimateExemptionReason("BELOW_THRESHOLD");
  static readonly AFTER_REPAIR = new EstimateExemptionReason("AFTER_REPAIR");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  /** 業務表示名（「消耗品のみ」/「10万円未満」/「事後見積」）。 */
  get label(): string {
    return LABEL_MAP[this._value as EstimateExemptionReasonValue];
  }

  /** Prisma 値から生成する。 */
  static from(value: string): EstimateExemptionReason {
    switch (value) {
      case "CONSUMABLE_ONLY":
        return EstimateExemptionReason.CONSUMABLE_ONLY;
      case "BELOW_THRESHOLD":
        return EstimateExemptionReason.BELOW_THRESHOLD;
      case "AFTER_REPAIR":
        return EstimateExemptionReason.AFTER_REPAIR;
      default:
        throw new ValidationError(
          `不正な免除理由です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
        );
    }
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as EstimateExemptionReasonValue)) {
      throw new ValidationError(
        `不正な免除理由です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }
}
