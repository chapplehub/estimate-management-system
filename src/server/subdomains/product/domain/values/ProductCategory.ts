import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = ["INDIVIDUAL", "CONSUMABLE", "SET"] as const;
type ProductCategoryValue = (typeof VALID_VALUES)[number];

/**
 * 商品区分値オブジェクト
 *
 * INDIVIDUAL: 個別商品 — 周辺商品を設定可能
 * CONSUMABLE: 消耗品 — 周辺商品は持てない
 * SET: セット商品 — 構成商品を保持、価格は常に0
 */
export class ProductCategory extends ValueObject<string, "ProductCategory"> {
  static readonly INDIVIDUAL = new ProductCategory("INDIVIDUAL");
  static readonly CONSUMABLE = new ProductCategory("CONSUMABLE");
  static readonly SET = new ProductCategory("SET");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  static from(value: string): ProductCategory {
    switch (value) {
      case "INDIVIDUAL":
        return ProductCategory.INDIVIDUAL;
      case "CONSUMABLE":
        return ProductCategory.CONSUMABLE;
      case "SET":
        return ProductCategory.SET;
      default:
        throw new ValidationError(
          `不正な商品区分です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
        );
    }
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as ProductCategoryValue)) {
      throw new ValidationError(
        `不正な商品区分です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }

  /** 周辺商品を持てるか（個別商品のみ） */
  canHaveRelatedProducts(): boolean {
    return this._value === "INDIVIDUAL";
  }

  /** 構成商品を持てるか（セット商品のみ） */
  canHaveComponents(): boolean {
    return this._value === "SET";
  }

  /** 周辺商品になれるか（セット商品以外） */
  canBeRelatedProduct(): boolean {
    return this._value !== "SET";
  }

  /** 構成商品になれるか（セット商品以外） */
  canBeComponent(): boolean {
    return this._value !== "SET";
  }
}
