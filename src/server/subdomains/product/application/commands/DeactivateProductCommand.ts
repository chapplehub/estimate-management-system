import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductRepository } from "@subdomains/product/domain/repositories/ProductRepository";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

export type DeactivateProductInput = {
  id: string;
  /** 画面表示時の version（楽観ロック / ADR-0039） */
  expectedVersion: number;
};

/**
 * 商品無効化コマンド（入れ替えなし）
 */
export class DeactivateProductCommand {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(input: DeactivateProductInput): Promise<Product> {
    const productId = new ProductId(input.id);
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundEntityError(Product, { id: input.id });
    }

    product.deactivate();

    return await this.productRepository.update(product, input.expectedVersion);
  }
}
