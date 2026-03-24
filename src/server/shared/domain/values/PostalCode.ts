import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 郵便番号値オブジェクト
 *
 * 7桁の数字。ハイフンあり/なしどちらも受け入れ、内部はハイフンなしで保持。
 */
export class PostalCode extends StringValueObject<"PostalCode"> {
  protected static readonly LABEL = "郵便番号";
  protected static readonly REGEX = /^[0-9]{7}$/;
  protected static readonly MIN_LENGTH = 7;
  protected static readonly MAX_LENGTH = 7;
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "郵便番号は7桁の数字で入力してください（例: 1234567）";

  constructor(value: string) {
    super(value.replace(/-/g, "").trim());
  }

  /** ハイフン付きフォーマット（例: 123-4567） */
  get formatted(): string {
    return `${this._value.slice(0, 3)}-${this._value.slice(3)}`;
  }
}
