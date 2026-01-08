import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 従業員名を表す値オブジェクト
 *
 * バリデーションルール:
 * - 最小長: 1文字（空文字列を拒否）
 * - 最大長: 100文字
 * - 前後の空白をトリム
 */
export class EmployeeName extends StringValueObject<"EmployeeName"> {
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 100;
  protected static readonly ERROR_MESSAGE_EMPTY = "名前を入力してください";
  protected static readonly ERROR_MESSAGE_TOO_SHORT = "名前を入力してください";
  protected static readonly ERROR_MESSAGE_TOO_LONG =
    "名前は100文字以内で入力してください";

  constructor(value: string) {
    super(value.trim());
  }
}
