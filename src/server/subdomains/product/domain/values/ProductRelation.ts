import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ComponentQuantity } from "./ComponentQuantity";
import { ProductCategory } from "./ProductCategory";
import { ProductId } from "./ProductId";

/**
 * 周辺商品値オブジェクト
 *
 * 個別商品に紐づく関連商品（個別商品 or 消耗品）の情報を表す。
 */
export class ProductRelation {
  private constructor(
    private readonly _relatedProductId: ProductId,
    private readonly _relatedProductCategory: ProductCategory,
    private readonly _quantity: ComponentQuantity
  ) {}

  static create(
    relatedProductId: ProductId,
    relatedProductCategory: ProductCategory,
    quantity: ComponentQuantity
  ): ProductRelation {
    if (!relatedProductCategory.canBeRelatedProduct()) {
      throw new BusinessRuleViolationError("セット商品は周辺商品として設定できません");
    }
    return new ProductRelation(relatedProductId, relatedProductCategory, quantity);
  }

  static reconstruct(
    relatedProductId: ProductId,
    relatedProductCategory: ProductCategory,
    quantity: ComponentQuantity
  ): ProductRelation {
    return new ProductRelation(relatedProductId, relatedProductCategory, quantity);
  }

  get relatedProductId(): ProductId {
    return this._relatedProductId;
  }

  get relatedProductCategory(): ProductCategory {
    return this._relatedProductCategory;
  }

  get quantity(): ComponentQuantity {
    return this._quantity;
  }
}
