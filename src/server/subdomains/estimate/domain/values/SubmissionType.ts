import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = ["CUSTOMER", "DELIVERY_LOCATION"] as const;
type SubmissionTypeValue = (typeof VALID_VALUES)[number];

const LABEL_MAP: Record<SubmissionTypeValue, string> = {
  CUSTOMER: "得意先向け",
  DELIVERY_LOCATION: "納品先向け",
};

/**
 * 見積提出先区分の値オブジェクト
 *
 * Prisma の `SubmissionType` enum と 1:1 対応。
 *
 * §7.2「納品先向け見積は申請・受注作成不可」の判定基盤として
 * `isCustomer()` / `isDeliveryLocation()` を提供する。
 */
export class SubmissionType extends ValueObject<string, "SubmissionType"> {
  static readonly CUSTOMER = new SubmissionType("CUSTOMER");
  static readonly DELIVERY_LOCATION = new SubmissionType("DELIVERY_LOCATION");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  /** 業務表示名（「得意先向け」/「納品先向け」）。 */
  get label(): string {
    return LABEL_MAP[this._value as SubmissionTypeValue];
  }

  isCustomer(): boolean {
    return this === SubmissionType.CUSTOMER;
  }

  isDeliveryLocation(): boolean {
    return this === SubmissionType.DELIVERY_LOCATION;
  }

  /** Prisma 値（"CUSTOMER" / "DELIVERY_LOCATION"）から生成する。 */
  static from(value: string): SubmissionType {
    switch (value) {
      case "CUSTOMER":
        return SubmissionType.CUSTOMER;
      case "DELIVERY_LOCATION":
        return SubmissionType.DELIVERY_LOCATION;
      default:
        throw new ValidationError(
          `不正な提出先区分です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
        );
    }
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as SubmissionTypeValue)) {
      throw new ValidationError(
        `不正な提出先区分です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }
}
