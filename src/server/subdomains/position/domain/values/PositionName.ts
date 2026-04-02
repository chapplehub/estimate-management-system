import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 役職名値オブジェクト
 *
 * バリデーション:
 * - 1〜50文字
 * - 空白のみは不可
 */
export class PositionName extends StringValueObject<"PositionName"> {
  protected static readonly LABEL = "役職名";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 50;

  constructor(value: string) {
    super(value.trim());
  }
}
