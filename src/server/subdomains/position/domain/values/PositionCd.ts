import { ValidationError } from "@server/shared/errors/DomainError";
import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 役職コード値オブジェクト
 *
 * 形式: POS + 3桁の数字（POS001 〜 POS999）
 */
export class PositionCd extends StringValueObject<"PositionCd"> {
  private static readonly PREFIX = "POS";
  private static readonly NUMERIC_LENGTH = 3;
  private static readonly TOTAL_LENGTH = 6; // "POS" + 3桁 = 6文字
  private static readonly NUMERIC_MIN = 1;
  private static readonly NUMERIC_MAX = Math.pow(10, PositionCd.NUMERIC_LENGTH) - 1;

  protected static readonly REGEX = new RegExp(
    `^${PositionCd.PREFIX}\\d{${PositionCd.NUMERIC_LENGTH}}$`,
    "i"
  );
  protected static readonly MIN_LENGTH = PositionCd.TOTAL_LENGTH;
  protected static readonly MAX_LENGTH = PositionCd.TOTAL_LENGTH;
  protected static readonly ERROR_MESSAGE_EMPTY = "役職コードは必須です";
  protected static readonly ERROR_MESSAGE_TOO_SHORT =
    "役職コードは POS + 3桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_TOO_LONG =
    "役職コードは POS + 3桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "役職コードは POS + 3桁の数字である必要があります";

  constructor(value: string) {
    super(value.toUpperCase().trim());
  }

  get numericPart(): number {
    return PositionCd.extractNumericPart(this._value);
  }

  protected validate(value: string): void {
    super.validate(value);

    const numericPart = PositionCd.extractNumericPart(value);
    if (numericPart < PositionCd.NUMERIC_MIN) {
      throw new ValidationError(`役職コードは ${PositionCd.NUMERIC_MIN} 以上である必要があります`);
    }
    if (numericPart > PositionCd.NUMERIC_MAX) {
      throw new ValidationError(`役職コードは ${PositionCd.NUMERIC_MAX} 以下である必要があります`);
    }
  }

  private static extractNumericPart(value: string): number {
    return parseInt(value.substring(PositionCd.PREFIX.length), 10);
  }

  static fromNumber(num: number): PositionCd {
    if (num < PositionCd.NUMERIC_MIN || num > PositionCd.NUMERIC_MAX) {
      throw new ValidationError(
        `役職コードは ${PositionCd.NUMERIC_MIN} 〜 ${PositionCd.NUMERIC_MAX} の範囲である必要があります`
      );
    }

    const paddedNumber = num.toString().padStart(PositionCd.NUMERIC_LENGTH, "0");
    return new PositionCd(`${PositionCd.PREFIX}${paddedNumber}`);
  }
}
