import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 備考値オブジェクト
 *
 * 最大1000桁。任意項目。
 */
export class ProductNote extends StringValueObject<"ProductNote"> {
  protected static readonly LABEL = "備考";
  protected static readonly MAX_LENGTH = 1000;

  constructor(value: string) {
    super(value.trim());
  }
}
