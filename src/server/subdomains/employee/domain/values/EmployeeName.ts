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
  protected static readonly LABEL = "名前";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 100;

  constructor(value: string) {
    super(value.trim());
  }
}
