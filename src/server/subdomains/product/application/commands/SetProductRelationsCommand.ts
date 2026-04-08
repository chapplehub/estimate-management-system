import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductRepository } from "@subdomains/product/domain/repositories/ProductRepository";
import { ComponentQuantity } from "@subdomains/product/domain/values/ComponentQuantity";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductRelation } from "@subdomains/product/domain/values/ProductRelation";

export type SetProductRelationsInput = {
  productId: string;
  relations: { relatedProductId: string; quantity: number }[];
};

/**
 * 周辺商品設定コマンド
 *
 * 個別商品の周辺商品を全置換する。
 */
export class SetProductRelationsCommand {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(input: SetProductRelationsInput): Promise<Product> {
    const productId = new ProductId(input.productId);
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundEntityError(Product, { id: input.productId });
    }

    // 各周辺商品の存在確認 + VO生成
    const relations: ProductRelation[] = [];
    for (const rel of input.relations) {
      const relatedProductId = new ProductId(rel.relatedProductId);
      const relatedProduct = await this.productRepository.findById(relatedProductId);
      if (!relatedProduct) {
        throw new NotFoundEntityError(Product, { id: rel.relatedProductId });
      }

      relations.push(
        ProductRelation.create(
          relatedProductId,
          relatedProduct.category,
          new ComponentQuantity(rel.quantity)
        )
      );
    }

    // Entity側でB003/B005/重複チェック
    product.setRelatedProducts(relations);

    return await this.productRepository.save(product);
  }
}
