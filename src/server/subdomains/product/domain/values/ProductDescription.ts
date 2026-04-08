import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 商品説明値オブジェクト
 *
 * 最大1000桁。任意項目。
 */
export class ProductDescription extends StringValueObject<"ProductDescription"> {
  protected static readonly LABEL = "商品説明";
  protected static readonly MAX_LENGTH = 1000;

  constructor(value: string) {
    super(value.trim());
  }
}
