import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * 数量値オブジェクト（見積明細）。
 *
 * 正の整数（1以上）。DB スキーマの `quantity Int // 正の整数` と整合。
 */
export class Quantity extends ValueObject<number, "Quantity"> {
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
    if (!Number.isInteger(value) || value < 1) {
      throw new ValidationError("数量は1以上の整数で指定してください");
    }
  }
}
