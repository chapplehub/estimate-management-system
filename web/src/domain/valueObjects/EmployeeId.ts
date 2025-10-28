import { ValidationError } from "@/shared/errors/DomainError";
import { ValueObject } from "@/shared/ValueObject";

/**
 * 社員番号値オブジェクト
 *
 * 形式: EMP + 6桁の数字（例: EMP000001）
 * 範囲: EMP000001 〜 EMP999999
 */
type EmployeeIdValue = string;
export class EmployeeId extends ValueObject<EmployeeIdValue, "EmployeeId"> {
  private static readonly PREFIX = "EMP";
  private static readonly NUMERIC_LENGTH = 6;
  private static readonly MIN_LENGTH = 1;
  private static readonly MAX_LENGTH =
    Math.pow(10, EmployeeId.NUMERIC_LENGTH) - 1;
  private static readonly PATTERN = new RegExp(
    `^${EmployeeId.PREFIX}\\d{${EmployeeId.NUMERIC_LENGTH}}$`,
    "i"
  );

  constructor(value: EmployeeIdValue) {
    super(value.toUpperCase().trim());
  }

  get value(): string {
    return this._value;
  }

  get numericPart(): number {
    return EmployeeId.extractNumericPart(this._value);
  }

  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new ValidationError("社員番号は必須です");
    }

    const trimmedValue = value.trim().toUpperCase();

    // 形式チェック（EMP + 6桁の数字）
    if (!EmployeeId.PATTERN.test(trimmedValue)) {
      if (!trimmedValue.startsWith(EmployeeId.PREFIX)) {
        throw new ValidationError("社員番号は EMP で始まる必要があります");
      }
      throw new ValidationError(
        "社員番号は EMP + 6桁の数字である必要があります"
      );
    }

    const numericPart = EmployeeId.extractNumericPart(trimmedValue);
    if (numericPart < EmployeeId.MIN_LENGTH) {
      throw new ValidationError(
        `社員番号は ${EmployeeId.MIN_LENGTH} 以上である必要があります`
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
  private static fromNumber(num: number): EmployeeId {
    if (num < EmployeeId.MIN_LENGTH || num > EmployeeId.MAX_LENGTH) {
      throw new ValidationError(
        `社員番号は ${EmployeeId.MIN_LENGTH} 〜 ${EmployeeId.MAX_LENGTH} の範囲である必要があります`
      );
    }

    const paddedNumber = num
      .toString()
      .padStart(EmployeeId.NUMERIC_LENGTH, "0");
    return new EmployeeId(`${EmployeeId.PREFIX}${paddedNumber}`);
  }
}
