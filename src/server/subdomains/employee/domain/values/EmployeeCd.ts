import { ValidationError } from "@server/shared/errors/DomainError";
import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 社員コード値オブジェクト
 *
 * 形式: EMP + 6桁の数字（例: EMP000001）
 * 範囲: EMP000001 〜 EMP999999
 */
export class EmployeeCd extends StringValueObject<"EmployeeCd"> {
  private static readonly PREFIX = "EMP";
  private static readonly NUMERIC_LENGTH = 6;
  private static readonly TOTAL_LENGTH = 9; // "EMP" + 6桁 = 9文字
  private static readonly NUMERIC_MIN = 1;
  private static readonly NUMERIC_MAX = Math.pow(10, EmployeeCd.NUMERIC_LENGTH) - 1;

  protected static readonly REGEX = new RegExp(
    `^${EmployeeCd.PREFIX}\\d{${EmployeeCd.NUMERIC_LENGTH}}$`,
    "i"
  );
  protected static readonly MIN_LENGTH = EmployeeCd.TOTAL_LENGTH;
  protected static readonly MAX_LENGTH = EmployeeCd.TOTAL_LENGTH;
  protected static readonly ERROR_MESSAGE_EMPTY = "社員コードは必須です";
  protected static readonly ERROR_MESSAGE_TOO_SHORT =
    "社員コードは EMP + 6桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_TOO_LONG =
    "社員コードは EMP + 6桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "社員コードは EMP + 6桁の数字である必要があります";

  constructor(value: string) {
    super(value.toUpperCase().trim());
  }

  get numericPart(): number {
    return EmployeeCd.extractNumericPart(this._value);
  }

  protected validate(value: string): void {
    // 基本的な長さチェックと正規表現チェックは親クラスで実行
    super.validate(value);

    // 数値部分の範囲チェック（EMP000000を弾くため）
    const numericPart = EmployeeCd.extractNumericPart(value);
    if (numericPart < EmployeeCd.NUMERIC_MIN) {
      throw new ValidationError(`社員コードは ${EmployeeCd.NUMERIC_MIN} 以上である必要があります`);
    }
    if (numericPart > EmployeeCd.NUMERIC_MAX) {
      throw new ValidationError(`社員コードは ${EmployeeCd.NUMERIC_MAX} 以下である必要があります`);
    }
  }

  /**
   * 文字列から数値部分を抽出（内部用ヘルパー）
   * @param value 社員コード文字列（例: "EMP000123"）
   * @returns 数値部分（例: 123）
   */
  private static extractNumericPart(value: string): number {
    return parseInt(value.substring(EmployeeCd.PREFIX.length), 10);
  }

  /**
   * 数値から社員コードを生成（ユーティリティメソッド）
   */
  static fromNumber(num: number): EmployeeCd {
    if (num < EmployeeCd.NUMERIC_MIN || num > EmployeeCd.NUMERIC_MAX) {
      throw new ValidationError(
        `社員コードは ${EmployeeCd.NUMERIC_MIN} 〜 ${EmployeeCd.NUMERIC_MAX} の範囲である必要があります`
      );
    }

    const paddedNumber = num.toString().padStart(EmployeeCd.NUMERIC_LENGTH, "0");
    return new EmployeeCd(`${EmployeeCd.PREFIX}${paddedNumber}`);
  }
}
