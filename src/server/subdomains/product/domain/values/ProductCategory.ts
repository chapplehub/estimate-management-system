import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = ["INDIVIDUAL", "CONSUMABLE", "SET"] as const;
type ProductCategoryValue = (typeof VALID_VALUES)[number];

/**
 * 価格保守対象商品（Priceable Product）の区分値の単一の真実源。
 * 共通販売単価・原価を保守する対象＝個別商品・消耗品。セット商品は含まない。
 * @see CONTEXT.md「価格保守対象商品 (Priceable Product)」
 */
const PRICEABLE_VALUES = ["INDIVIDUAL", "CONSUMABLE"] as const;

/**
 * 商品区分値オブジェクト
 *
 * INDIVIDUAL: 個別商品 — 周辺商品を設定可能
 * CONSUMABLE: 消耗品 — 周辺商品は持てない
 * SET: セット商品 — 構成商品を保持。それ自体は価格を持たず、金額は構成商品から算出
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

  /**
   * 価格（単価・原価）を持ちうるか＝価格保守対象商品か（個別商品・消耗品）。
   * @see CONTEXT.md「価格保守対象商品 (Priceable Product)」
   */
  canHavePrice(): boolean {
    return PRICEABLE_VALUES.includes(this._value as (typeof PRICEABLE_VALUES)[number]);
  }

  /**
   * 価格保守対象商品の区分値リスト。原価一覧・共通販売単価一覧の母集合の定義に使う。
   * @see CONTEXT.md「価格保守対象商品 (Priceable Product)」
   */
  static priceableValues(): readonly string[] {
    return PRICEABLE_VALUES;
  /** セット商品か。価格集約（売単価・原価）の生成ガードで参照する（#515） */
  isSet(): boolean {
    return this._value === "SET";
  }
}
