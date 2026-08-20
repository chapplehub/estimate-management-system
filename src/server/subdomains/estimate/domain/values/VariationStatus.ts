import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = ["ACTIVE", "INACTIVE"] as const;
type VariationStatusValue = (typeof VALID_VALUES)[number];

const LABEL_MAP: Record<VariationStatusValue, string> = {
  ACTIVE: "有効",
  INACTIVE: "無効",
};

/**
 * 見積バリエーション状態の値オブジェクト
 *
 * Prisma の `VariationStatus` enum と 1:1 対応。
 *
 * §3.4「1見積につき申請できるバリエーションは1つのみ」の判定基盤として
 * `isActive()` を提供する。状態遷移自体は親エンティティ
 * (EstimateVariation) が `this._status = VariationStatus.INACTIVE` の形で
 * 行うため、本 VO には遷移メソッドを持たせない（VO の責務は「状態の表現」）。
 */
export class VariationStatus extends ValueObject<string, "VariationStatus"> {
  static readonly ACTIVE = new VariationStatus("ACTIVE");
  static readonly INACTIVE = new VariationStatus("INACTIVE");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  /** 業務表示名（「有効」/「無効」）。 */
  get label(): string {
    return LABEL_MAP[this._value as VariationStatusValue];
  }

  isActive(): boolean {
    return this === VariationStatus.ACTIVE;
  }

  isInactive(): boolean {
    return this === VariationStatus.INACTIVE;
  }

  /** Prisma 値（"ACTIVE" / "INACTIVE"）から生成する。 */
  static from(value: string): VariationStatus {
    switch (value) {
      case "ACTIVE":
        return VariationStatus.ACTIVE;
      case "INACTIVE":
        return VariationStatus.INACTIVE;
      default:
        throw new ValidationError(
          `不正なバリエーション状態です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
        );
    }
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as VariationStatusValue)) {
      throw new ValidationError(
        `不正なバリエーション状態です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }
}
