import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = ["NEW", "REPAIR", "AFTER_REPAIR"] as const;
type EstimateTypeValue = (typeof VALID_VALUES)[number];

const VALID_PREFIXES = ["N", "R", "A"] as const;
type EstimateTypePrefix = (typeof VALID_PREFIXES)[number];

const PREFIX_MAP: Record<EstimateTypeValue, EstimateTypePrefix> = {
  NEW: "N",
  REPAIR: "R",
  AFTER_REPAIR: "A",
};

const VALUE_BY_PREFIX: Record<EstimateTypePrefix, EstimateTypeValue> = {
  N: "NEW",
  R: "REPAIR",
  A: "AFTER_REPAIR",
};

const LABEL_MAP: Record<EstimateTypeValue, string> = {
  NEW: "新規",
  REPAIR: "修理",
  AFTER_REPAIR: "事後",
};

/**
 * 見積区分の値オブジェクト
 *
 * Prisma の `EstimateType` enum と採番接頭辞 (`N` / `R` / `A`) の対応を
 * ドメイン側で保持する。`from(value)` は Prisma 値（永続化復元用）、
 * `fromPrefix(prefix)` は採番形式の接頭辞用（`EstimateNumber.parse` から呼ぶ）。
 *
 * NEW: 新規見積 — 通常の見積
 * REPAIR: 修理見積（事前） — 修理対象品の事前見積
 * AFTER_REPAIR: 事後見積 — 修理完了後に作成する見積
 */
export class EstimateType extends ValueObject<string, "EstimateType"> {
  static readonly NEW = new EstimateType("NEW");
  static readonly REPAIR = new EstimateType("REPAIR");
  static readonly AFTER_REPAIR = new EstimateType("AFTER_REPAIR");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  /** 採番接頭辞（`N` / `R` / `A`）。 */
  get prefix(): EstimateTypePrefix {
    return PREFIX_MAP[this._value as EstimateTypeValue];
  }

  /** 業務表示名（「新規」/「修理」/「事後」、§1.1）。 */
  get label(): string {
    return LABEL_MAP[this._value as EstimateTypeValue];
  }

  /** Prisma 値（"NEW" / "REPAIR" / "AFTER_REPAIR"）から生成する。 */
  static from(value: string): EstimateType {
    switch (value) {
      case "NEW":
        return EstimateType.NEW;
      case "REPAIR":
        return EstimateType.REPAIR;
      case "AFTER_REPAIR":
        return EstimateType.AFTER_REPAIR;
      default:
        throw new ValidationError(
          `不正な見積区分です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
        );
    }
  }

  /** 採番接頭辞（"N" / "R" / "A"）から生成する。 */
  static fromPrefix(prefix: string): EstimateType {
    if (!(prefix in VALUE_BY_PREFIX)) {
      throw new ValidationError(
        `不正な見積区分の接頭辞です: ${prefix}（有効値: ${VALID_PREFIXES.join(", ")}）`
      );
    }
    return EstimateType.from(VALUE_BY_PREFIX[prefix as EstimateTypePrefix]);
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as EstimateTypeValue)) {
      throw new ValidationError(
        `不正な見積区分です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }
}
