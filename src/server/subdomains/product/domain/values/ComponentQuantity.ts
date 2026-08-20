import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * 構成数量値オブジェクト
 *
 * 周辺商品・セット構成の数量。正の整数（1以上）。
 */
export class ComponentQuantity extends ValueObject<number, "ComponentQuantity"> {
  constructor(value: number) {
    super(value);
  }

  get value(): number {
    return this._value;
  }

  protected validate(value: number): void {
    if (!Number.isFinite(value)) {
      throw new ValidationError("数量は有効な数値で指定してください");
    }
    if (!Number.isInteger(value)) {
      throw new ValidationError("数量は1以上の整数で指定してください");
    }
    if (value < 1) {
      throw new ValidationError("数量は1以上の整数で指定してください");
    }
  }
}
