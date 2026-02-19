import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * マージン率値オブジェクト
 *
 * 0.00〜100.00%の範囲で指定。
 */
export class MarginRate extends ValueObject<number, "MarginRate"> {
  private static readonly MIN = 0;
  private static readonly MAX = 100;

  constructor(value: number) {
    super(value);
  }

  get value(): number {
    return this._value;
  }

  protected validate(value: number): void {
    if (!Number.isFinite(value)) {
      throw new ValidationError("マージン率は有効な数値で指定してください");
    }
    if (value < MarginRate.MIN || value > MarginRate.MAX) {
      throw new ValidationError(
        `マージン率は${MarginRate.MIN}〜${MarginRate.MAX}%の範囲で指定してください`
      );
    }
  }
}
