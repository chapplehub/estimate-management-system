import { ValidationError } from "@server/shared/errors/DomainError";
import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 役割コード値オブジェクト
 *
 * 形式: ROLE + 3桁の数字（ROLE001 〜 ROLE999）
 */
export class RoleCd extends StringValueObject<"RoleCd"> {
  private static readonly PREFIX = "ROLE";
  private static readonly NUMERIC_LENGTH = 3;
  private static readonly TOTAL_LENGTH = 7; // "ROLE" + 3桁 = 7文字
  private static readonly NUMERIC_MIN = 1;
  private static readonly NUMERIC_MAX = Math.pow(10, RoleCd.NUMERIC_LENGTH) - 1;

  protected static readonly REGEX = new RegExp(
    `^${RoleCd.PREFIX}\\d{${RoleCd.NUMERIC_LENGTH}}$`,
    "i"
  );
  protected static readonly MIN_LENGTH = RoleCd.TOTAL_LENGTH;
  protected static readonly MAX_LENGTH = RoleCd.TOTAL_LENGTH;
  protected static readonly ERROR_MESSAGE_EMPTY = "役割コードは必須です";
  protected static readonly ERROR_MESSAGE_TOO_SHORT =
    "役割コードは ROLE + 3桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_TOO_LONG =
    "役割コードは ROLE + 3桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "役割コードは ROLE + 3桁の数字である必要があります";

  constructor(value: string) {
    super(value.toUpperCase().trim());
  }

  get numericPart(): number {
    return RoleCd.extractNumericPart(this._value);
  }

  protected validate(value: string): void {
    super.validate(value);

    const numericPart = RoleCd.extractNumericPart(value);
    if (numericPart < RoleCd.NUMERIC_MIN) {
      throw new ValidationError(`役割コードは ${RoleCd.NUMERIC_MIN} 以上である必要があります`);
    }
    if (numericPart > RoleCd.NUMERIC_MAX) {
      throw new ValidationError(`役割コードは ${RoleCd.NUMERIC_MAX} 以下である必要があります`);
    }
  }

  private static extractNumericPart(value: string): number {
    return parseInt(value.substring(RoleCd.PREFIX.length), 10);
  }

  static fromNumber(num: number): RoleCd {
    if (num < RoleCd.NUMERIC_MIN || num > RoleCd.NUMERIC_MAX) {
      throw new ValidationError(
        `役割コードは ${RoleCd.NUMERIC_MIN} 〜 ${RoleCd.NUMERIC_MAX} の範囲である必要があります`
      );
    }

    const paddedNumber = num.toString().padStart(RoleCd.NUMERIC_LENGTH, "0");
    return new RoleCd(`${RoleCd.PREFIX}${paddedNumber}`);
  }
}
