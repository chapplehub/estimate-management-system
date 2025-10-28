import { ValidationError } from "@/shared/errors/DomainError";
import { ValueObject } from "@/shared/ValueObject";

type MailAddressValue = string;
export class MailAddress extends ValueObject<MailAddressValue, "MailAddress"> {
  constructor(value: string) {
    super(value.toLowerCase().trim());
  }

  get value(): MailAddressValue {
    return this._value;
  }

  protected validate(value: MailAddressValue): void {
    if (!value || value.trim().length === 0) {
      throw new ValidationError("メールアドレスは必須です");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError("メールアドレスの形式が正しくありません");
    }
  }
}
