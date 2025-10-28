import { ValidationError } from "@/shared/errors/DomainError";
import { StringValueObject } from "@/shared/StringValueObject";

/**
 * 社員番号値オブジェクト
 *
 * 形式: EMP + 6桁の数字（例: EMP000001）
 * 範囲: EMP000001 〜 EMP999999
 */
export class EmployeeId extends StringValueObject<"EmployeeId"> {
  private static readonly PREFIX = "EMP";
  private static readonly NUMERIC_LENGTH = 6;
  private static readonly TOTAL_LENGTH = 9; // "EMP" + 6桁 = 9文字
  private static readonly NUMERIC_MIN = 1;
  private static readonly NUMERIC_MAX =
    Math.pow(10, EmployeeId.NUMERIC_LENGTH) - 1;

  protected static readonly REGEX = new RegExp(
    `^${EmployeeId.PREFIX}\\d{${EmployeeId.NUMERIC_LENGTH}}$`,
    "i"
  );
  protected static readonly MIN_LENGTH = EmployeeId.TOTAL_LENGTH;
  protected static readonly MAX_LENGTH = EmployeeId.TOTAL_LENGTH;
  protected static readonly ERROR_MESSAGE_EMPTY = "社員番号は必須です";
  protected static readonly ERROR_MESSAGE_TOO_SHORT =
    "社員番号は EMP + 6桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_TOO_LONG =
    "社員番号は EMP + 6桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "社員番号は EMP + 6桁の数字である必要があります";

  constructor(value: string) {
    super(value.toUpperCase().trim());
  }

  get numericPart(): number {
    return EmployeeId.extractNumericPart(this._value);
  }

  protected validate(value: string): void {
    // 基本的な長さチェックと正規表現チェックは親クラスで実行
    super.validate(value);

    // 数値部分の範囲チェック（EMP000000を弾くため）
    const numericPart = EmployeeId.extractNumericPart(value);
    if (numericPart < EmployeeId.NUMERIC_MIN) {
      throw new ValidationError(
        `社員番号は ${EmployeeId.NUMERIC_MIN} 以上である必要があります`
      );
    }
    if (numericPart > EmployeeId.NUMERIC_MAX) {
      throw new ValidationError(
        `社員番号は ${EmployeeId.NUMERIC_MAX} 以下である必要があります`
      );
    }
  }

  /**
   * 文字列から数値部分を抽出（内部用ヘルパー）
   * @param value 社員番号文字列（例: "EMP000123"）
   * @returns 数値部分（例: 123）
   */
  private static extractNumericPart(value: string): number {
    return parseInt(value.substring(EmployeeId.PREFIX.length), 10);
  }

  /**
   * 数値から社員番号を生成（ユーティリティメソッド）
   */
  static fromNumber(num: number): EmployeeId {
    if (num < EmployeeId.NUMERIC_MIN || num > EmployeeId.NUMERIC_MAX) {
      throw new ValidationError(
        `社員番号は ${EmployeeId.NUMERIC_MIN} 〜 ${EmployeeId.NUMERIC_MAX} の範囲である必要があります`
      );
    }

    const paddedNumber = num
      .toString()
      .padStart(EmployeeId.NUMERIC_LENGTH, "0");
    return new EmployeeId(`${EmployeeId.PREFIX}${paddedNumber}`);
  }
}
