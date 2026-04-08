import { ProductRepository } from "../repositories/ProductRepository";
import { ProductId } from "../values/ProductId";

/**
 * 商品削除可否チェックドメインサービス
 *
 * 見積・受注で使用中の商品は削除できない。
 * TODO: Estimateモデル実装時に実際のチェックロジックに更新
 */
export class ProductDeletionCheckDomainService {
  constructor(private readonly productRepository: ProductRepository) {}

  /**
   * @returns 削除可能な場合 true
   */
  async execute(id: ProductId): Promise<boolean> {
    const inUse = await this.productRepository.existsInEstimateOrOrder(id);
    return !inUse;
  }
}
