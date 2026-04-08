import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 商品名値オブジェクト
 *
 * 最大100桁。入力時にトリムされる。
 */
export class ProductName extends StringValueObject<"ProductName"> {
  protected static readonly LABEL = "商品名";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 100;
  protected static readonly ERROR_MESSAGE_EMPTY = "商品名は必須です";

  constructor(value: string) {
    super(value.trim());
  }
}
