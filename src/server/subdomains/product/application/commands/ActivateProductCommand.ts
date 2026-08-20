import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductRepository } from "@subdomains/product/domain/repositories/ProductRepository";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

export type ActivateProductInput = {
  id: string;
  /** 画面表示時の version（楽観ロック / ADR-0039） */
  expectedVersion: number;
};

/**
 * 商品有効化コマンド
 */
export class ActivateProductCommand {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(input: ActivateProductInput): Promise<Product> {
    const productId = new ProductId(input.id);
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundEntityError(Product, { id: input.id });
    }

    product.activate();

    return await this.productRepository.update(product, input.expectedVersion);
  }
}
