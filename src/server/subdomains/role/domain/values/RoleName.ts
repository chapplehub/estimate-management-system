import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 役割名値オブジェクト
 *
 * バリデーション:
 * - 1〜100文字
 * - 空白のみは不可
 */
export class RoleName extends StringValueObject<"RoleName"> {
  protected static readonly LABEL = "役割名";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 100;

  constructor(value: string) {
    super(value.trim());
  }
}
