import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductRepository } from "@subdomains/product/domain/repositories/ProductRepository";
import { ProductDeletionCheckDomainService } from "@subdomains/product/domain/services/ProductDeletionCheckDomainService";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

export type DeleteProductInput = {
  id: string;
};

/**
 * 商品削除コマンド
 */
export class DeleteProductCommand {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly productDeletionCheck: ProductDeletionCheckDomainService
  ) {}

  async execute(input: DeleteProductInput): Promise<void> {
    const productId = new ProductId(input.id);
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundEntityError(Product, { id: input.id });
    }

    // B008: 見積・受注で使用中の場合は削除不可
    const canDelete = await this.productDeletionCheck.execute(productId);
    if (!canDelete) {
      throw new BusinessRuleViolationError("見積・受注で使用中の商品は削除できません");
    }

    await this.productRepository.delete(productId);
  }
}
