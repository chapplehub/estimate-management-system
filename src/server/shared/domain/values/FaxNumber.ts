import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * FAX番号値オブジェクト
 *
 * 電話番号と同じ形式。ハイフンあり/なしどちらも受け入れ、内部はハイフンなしで保持。
 */
export class FaxNumber extends StringValueObject<"FaxNumber"> {
  protected static readonly LABEL = "FAX番号";
  protected static readonly REGEX = /^[0-9]{10,11}$/;
  protected static readonly MIN_LENGTH = 10;
  protected static readonly MAX_LENGTH = 11;
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "FAX番号は10〜11桁の数字で入力してください";

  constructor(value: string) {
    super(value.replace(/-/g, "").trim());
  }
}
