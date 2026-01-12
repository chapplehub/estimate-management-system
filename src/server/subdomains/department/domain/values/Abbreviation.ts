import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 部署略称値オブジェクト
 *
 * バリデーション:
 * - 1〜20文字
 * - 空白のみは不可
 */
export class Abbreviation extends StringValueObject<"Abbreviation"> {
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 20;
  protected static readonly ERROR_MESSAGE_EMPTY = "部署略称は必須です";
  protected static readonly ERROR_MESSAGE_TOO_SHORT = "部署略称は必須です";
  protected static readonly ERROR_MESSAGE_TOO_LONG =
    "部署略称は20文字以内である必要があります";

  constructor(value: string) {
    super(value.trim());
  }
}
