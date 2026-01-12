import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 部署略称値オブジェクト
 *
 * バリデーション:
 * - 1〜20文字
 * - 空白のみは不可
 */
export class Abbreviation extends StringValueObject<"Abbreviation"> {
  protected static readonly LABEL = "部署略称";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 20;

  constructor(value: string) {
    super(value.trim());
  }
}
