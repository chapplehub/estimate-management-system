import { ValidationError } from "@/shared/errors/DomainError";

/**
 * メールアドレス値オブジェクト
 */
export class Email {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.toLowerCase().trim();
  }

  get value(): string {
    return this._value;
  }

  /**
   * バリデーション
   */
  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new ValidationError("メールアドレスは必須です");
    }

    // 基本的なメール形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError("メールアドレスの形式が正しくありません");
    }
  }

  /**
   * 等価性チェック
   */
  equals(other: Email): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return this._value;
  }
}
