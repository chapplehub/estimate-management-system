import { ValidationError } from "@/shared/errors/DomainError";

/**
 * 社員番号値オブジェクト
 *
 * 形式: EMP + 6桁の数字（例: EMP000001）
 * 範囲: EMP000001 〜 EMP999999
 */
export class EmployeeId {
  private readonly _value: string;
  private static readonly PREFIX: "EMP";
  private static readonly NUMERIC_LENGTH: 6;
  private static readonly PATTERN = /^EMP\d{6}$/i;

  constructor(value: string) {
    this.validate(value);
    const paddingValue = value.padStart(6, "0");
    this._value = EmployeeId.PREFIX.concat(paddingValue).trim();
  }

  get value(): string {
    return this._value;
  }

  /* 数値部分を取得*/
  get numericPart(): number {
    const prefixLength = EmployeeId.PREFIX.length;
    return parseInt(this._value.slice(prefixLength), 10);
  }

  /**
   * バリデーション
   */
  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new ValidationError("EmployeeIdは必須です");
    }

    // 基本的なメール形式チェック
    if (!EmployeeId.PATTERN.test(value)) {
      throw new ValidationError("EmployeeIdの形式が正しくありません");
    }
  }

  /**
   * 等価性チェック
   */
  equals(other: EmployeeId): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
