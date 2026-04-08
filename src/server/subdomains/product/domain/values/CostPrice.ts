import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * 原価値オブジェクト
 *
 * 0以上、小数点以下2桁まで。
 */
export class CostPrice extends ValueObject<number, "CostPrice"> {
  constructor(value: number) {
    super(value);
  }

  get value(): number {
    return this._value;
  }

  protected validate(value: number): void {
    if (!Number.isFinite(value)) {
      throw new ValidationError("原価は有効な数値で指定してください");
    }
    if (value < 0) {
      throw new ValidationError("原価は0以上で指定してください");
    }
    // 小数点以下2桁チェック
    const decimalPart = value.toString().split(".")[1];
    if (decimalPart && decimalPart.length > 2) {
      throw new ValidationError("原価は小数点以下2桁までで指定してください");
    }
  }
}
