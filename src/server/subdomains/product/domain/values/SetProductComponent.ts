import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ComponentQuantity } from "./ComponentQuantity";
import { ProductCategory } from "./ProductCategory";
import { ProductId } from "./ProductId";

/**
 * セット構成商品値オブジェクト
 *
 * セット商品に含まれる構成商品（個別商品 or 消耗品）の情報を表す。
 */
export class SetProductComponent {
  private constructor(
    private readonly _componentProductId: ProductId,
    private readonly _componentProductCategory: ProductCategory,
    private readonly _quantity: ComponentQuantity
  ) {}

  static create(
    componentProductId: ProductId,
    componentProductCategory: ProductCategory,
    quantity: ComponentQuantity
  ): SetProductComponent {
    if (!componentProductCategory.canBeComponent()) {
      throw new BusinessRuleViolationError("セット商品を構成商品として設定することはできません");
    }
    return new SetProductComponent(componentProductId, componentProductCategory, quantity);
  }

  static reconstruct(
    componentProductId: ProductId,
    componentProductCategory: ProductCategory,
    quantity: ComponentQuantity
  ): SetProductComponent {
    return new SetProductComponent(componentProductId, componentProductCategory, quantity);
  }

  get componentProductId(): ProductId {
    return this._componentProductId;
  }

  get componentProductCategory(): ProductCategory {
    return this._componentProductCategory;
  }

  get quantity(): ComponentQuantity {
    return this._quantity;
  }
}
