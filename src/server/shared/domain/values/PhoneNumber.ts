import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 電話番号値オブジェクト
 *
 * 日本国内の電話番号形式。ハイフンあり/なしどちらも受け入れ、内部はハイフンなしで保持。
 */
export class PhoneNumber extends StringValueObject<"PhoneNumber"> {
  protected static readonly LABEL = "電話番号";
  protected static readonly REGEX = /^[0-9]{10,11}$/;
  protected static readonly MIN_LENGTH = 10;
  protected static readonly MAX_LENGTH = 11;
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "電話番号は10〜11桁の数字で入力してください";

  constructor(value: string) {
    super(value.replace(/-/g, "").trim());
  }
}
