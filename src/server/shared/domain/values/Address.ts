import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 住所値オブジェクト（市区町村以降）
 */
export class Address extends StringValueObject<"Address"> {
  protected static readonly LABEL = "住所";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 200;

  constructor(value: string) {
    super(value.trim());
  }
}
