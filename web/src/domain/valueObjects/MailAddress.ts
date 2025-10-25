import { ValidationError } from "@/shared/errors/DomainError";
import { isEqual } from "es-toolkit/compat";

export class MailAddress {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.toLowerCase().trim();
  }

  get value(): string {
    return this._value;
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new ValidationError("メールアドレスは必須です");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError("メールアドレスの形式が正しくありません");
    }
  }

  equals(other: MailAddress): boolean {
    return isEqual(this._value, other._value);
  }
}
