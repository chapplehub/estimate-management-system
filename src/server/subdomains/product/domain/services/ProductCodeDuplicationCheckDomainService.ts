import { ProductRepository } from "../repositories/ProductRepository";
import { ProductCode } from "../values/ProductCode";
import { ProductId } from "../values/ProductId";

/**
 * 商品コード重複チェックドメインサービス
 */
export class ProductCodeDuplicationCheckDomainService {
  constructor(private readonly productRepository: ProductRepository) {}

  /**
   * @param code 検査する商品コード
   * @param excludeId 除外するID（更新時に自分自身を除外するため）
   * @returns 重複がある場合 true
   */
  async execute(code: ProductCode, excludeId?: ProductId): Promise<boolean> {
    const existing = await this.productRepository.findByCode(code);
    if (!existing) {
      return false;
    }
    if (excludeId && existing.id.equals(excludeId)) {
      return false;
    }
    return true;
  }
}
