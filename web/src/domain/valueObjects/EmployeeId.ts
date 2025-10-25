import { ValidationError } from "@/shared/errors/DomainError";
import { isEqual } from "es-toolkit/compat";

/**
 * 社員番号値オブジェクト
 *
 * 形式: EMP + 6桁の数字（例: EMP000001）
 * 範囲: EMP000001 〜 EMP999999
 */
export class EmployeeId {
  private readonly _value: string;
  private static readonly PREFIX = "EMP";
  private static readonly NUMERIC_LENGTH = 6;
  private static readonly MIN_NUMBER = 1;
  private static readonly MAX_NUMBER =
    Math.pow(10, EmployeeId.NUMERIC_LENGTH) - 1;
  private static readonly PATTERN = new RegExp(
    `^${EmployeeId.PREFIX}\\d{${EmployeeId.NUMERIC_LENGTH}}$`,
    "i"
  );

  constructor(value: string) {
    this.validate(value);
    this._value = value.toUpperCase().trim();
  }

  get value(): string {
    return this._value;
  }

  get numericPart(): number {
    return EmployeeId.extractNumericPart(this._value);
  }

  private validate(value: string): void {
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
    if (numericPart < EmployeeId.MIN_NUMBER) {
      throw new ValidationError(
        `社員番号は ${EmployeeId.MIN_NUMBER} 以上である必要があります`
      );
    }
  }

  equals(other: EmployeeId): boolean {
    return isEqual(this._value, other._value);
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
    if (num < EmployeeId.MIN_NUMBER || num > EmployeeId.MAX_NUMBER) {
      throw new ValidationError(
        `社員番号は ${EmployeeId.MIN_NUMBER} 〜 ${EmployeeId.MAX_NUMBER} の範囲である必要があります`
      );
    }

    const paddedNumber = num
      .toString()
      .padStart(EmployeeId.NUMERIC_LENGTH, "0");
    return new EmployeeId(`${EmployeeId.PREFIX}${paddedNumber}`);
  }
}
