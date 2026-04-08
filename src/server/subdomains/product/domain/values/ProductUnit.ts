import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = ["UNIT", "PIECE", "ROLL", "BOX", "SHEET", "SET"] as const;
type ProductUnitValue = (typeof VALID_VALUES)[number];

const LABELS: Record<ProductUnitValue, string> = {
  UNIT: "台",
  PIECE: "個",
  ROLL: "本",
  BOX: "箱",
  SHEET: "枚",
  SET: "セット",
};

/**
 * 単位値オブジェクト
 */
export class ProductUnit extends ValueObject<string, "ProductUnit"> {
  static readonly UNIT = new ProductUnit("UNIT");
  static readonly PIECE = new ProductUnit("PIECE");
  static readonly ROLL = new ProductUnit("ROLL");
  static readonly BOX = new ProductUnit("BOX");
  static readonly SHEET = new ProductUnit("SHEET");
  static readonly SET = new ProductUnit("SET");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  static from(value: string): ProductUnit {
    if (!VALID_VALUES.includes(value as ProductUnitValue)) {
      throw new ValidationError(`不正な単位です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`);
    }
    return new ProductUnit(value);
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as ProductUnitValue)) {
      throw new ValidationError(`不正な単位です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`);
    }
  }

  /** 日本語ラベルを返す */
  label(): string {
    return LABELS[this._value as ProductUnitValue];
  }
}
