import { InvalidArgumentError } from "@server/shared/errors/DomainError";

export type Primitives = string | number | boolean | Date;

export abstract class ValueObject<T extends Primitives, U> {
  /**
   * ブランドプロパティ: 構造的型付けを回避し、型の誤用を防ぐ
   * このプロパティは実行時には存在せず、コンパイル時の型チェックのみに使用される
   */
  declare private _type: U;
  protected readonly _value: T;

  constructor(value: T) {
    this._value = value;
    this.ensureValueIsDefined(value);
    this.validate(value);
  }

  private ensureValueIsDefined(value: T): void {
    if (value === null || value === undefined) {
      throw new InvalidArgumentError("Value must be defined");
    }
  }

  protected abstract validate(value: T): void;

  equals(other: ValueObject<T, U>): boolean {
    // LEARN: value-object-type-safety-strategies
    if (other.constructor.name !== this.constructor.name) {
      return false;
    }
    return other._value === this._value;
  }

  toString(): string {
    return this._value.toString();
  }
}
