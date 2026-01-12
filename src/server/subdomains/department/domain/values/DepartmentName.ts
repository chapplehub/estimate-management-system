import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 部署名値オブジェクト
 *
 * バリデーション:
 * - 1〜100文字
 * - 空白のみは不可
 */
export class DepartmentName extends StringValueObject<"DepartmentName"> {
  protected static readonly LABEL = "部署名";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 100;

  constructor(value: string) {
    super(value.trim());
  }
}
