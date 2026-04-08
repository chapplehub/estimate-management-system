import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 商品コード値オブジェクト
 *
 * 英数字のみ、最大50桁。入力時に大文字変換+トリムされる。
 */
export class ProductCode extends StringValueObject<"ProductCode"> {
  protected static readonly LABEL = "商品コード";
  protected static readonly REGEX = /^[A-Z0-9]+$/;
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 50;
  protected static readonly ERROR_MESSAGE_EMPTY = "商品コードは必須です";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "商品コードは英数字のみで入力してください";

  constructor(value: string) {
    super(value.trim().toUpperCase());
  }
}
