import { ProductRepository } from "../repositories/ProductRepository";
import { ProductId } from "../values/ProductId";
import { ProductName } from "../values/ProductName";

/**
 * 商品名重複チェックドメインサービス
 */
export class ProductNameDuplicationCheckDomainService {
  constructor(private readonly productRepository: ProductRepository) {}

  /**
   * @param name 検査する商品名
   * @param excludeId 除外するID（更新時に自分自身を除外するため）
   * @returns 重複がある場合 true
   */
  async execute(name: ProductName, excludeId?: ProductId): Promise<boolean> {
    const existing = await this.productRepository.findByName(name);
    if (!existing) {
      return false;
    }
    if (excludeId && existing.id.equals(excludeId)) {
      return false;
    }
    return true;
  }
}
