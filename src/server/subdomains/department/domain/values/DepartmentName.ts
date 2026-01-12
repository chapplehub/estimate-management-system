import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 部署名値オブジェクト
 *
 * バリデーション:
 * - 1〜100文字
 * - 空白のみは不可
 */
export class DepartmentName extends StringValueObject<"DepartmentName"> {
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 100;
  protected static readonly ERROR_MESSAGE_EMPTY = "部署名は必須です";
  protected static readonly ERROR_MESSAGE_TOO_SHORT = "部署名は必須です";
  protected static readonly ERROR_MESSAGE_TOO_LONG =
    "部署名は100文字以内である必要があります";

  constructor(value: string) {
    super(value.trim());
  }
}
