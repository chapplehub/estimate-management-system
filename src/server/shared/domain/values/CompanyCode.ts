import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 取引先コード値オブジェクト
 *
 * 手入力のコード。英数字・ハイフン・アンダースコアを許可。
 * 大文字に正規化される。
 */
export class CompanyCode extends StringValueObject<"CompanyCode"> {
  protected static readonly LABEL = "取引先コード";
  protected static readonly REGEX = /^[A-Z0-9\-_]+$/;
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 20;
  protected static readonly ERROR_MESSAGE_EMPTY = "取引先コードは必須です";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "取引先コードは英数字・ハイフン・アンダースコアのみ使用できます";

  constructor(value: string) {
    super(value.toUpperCase().trim());
  }
}
