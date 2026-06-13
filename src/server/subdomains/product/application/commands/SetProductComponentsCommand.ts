import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductRepository } from "@subdomains/product/domain/repositories/ProductRepository";
import { ComponentQuantity } from "@subdomains/product/domain/values/ComponentQuantity";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { SetProductComponent } from "@subdomains/product/domain/values/SetProductComponent";

export type SetProductComponentsInput = {
  productId: string;
  /** 画面表示時の version（楽観ロック / ADR-0039） */
  expectedVersion: number;
  components: { componentProductId: string; quantity: number }[];
};

/**
 * セット構成商品設定コマンド
 *
 * SET商品の構成商品を全置換する。
 */
export class SetProductComponentsCommand {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(input: SetProductComponentsInput): Promise<Product> {
    const productId = new ProductId(input.productId);
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundEntityError(Product, { id: input.productId });
    }

    // 各構成商品の存在確認 + VO生成
    const components: SetProductComponent[] = [];
    for (const comp of input.components) {
      const componentProductId = new ProductId(comp.componentProductId);
      const componentProduct = await this.productRepository.findById(componentProductId);
      if (!componentProduct) {
        throw new NotFoundEntityError(Product, { id: comp.componentProductId });
      }

      components.push(
        SetProductComponent.create(
          componentProductId,
          componentProduct.category,
          new ComponentQuantity(comp.quantity)
        )
      );
    }

    // Entity側でB006/重複チェック
    product.setComponents(components);

    return await this.productRepository.update(product, input.expectedVersion);
  }
}
