import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Product } from "../entities/Product";
import { ProductId } from "../values/ProductId";

/**
 * 商品入れ替えバリデーションドメインサービス
 *
 * 入れ替え先商品の妥当性チェック（B013〜B015）のみ担当。
 * 実際の入れ替え処理はCommand層がオーケストレーションする。
 */
export class ProductReplacementDomainService {
  /**
   * 入れ替え先の妥当性を検証する
   *
   * @param targetId 無効化対象の商品ID
   * @param replacement 入れ替え先の商品
   * @param referencingProducts targetを参照している商品リスト
   * @throws BusinessRuleViolationError B013/B014/B015 違反時
   */
  validateReplacement(
    targetId: ProductId,
    replacement: Product,
    referencingProducts: Product[]
  ): void {
    // B013: 入れ替え先は有効な商品であること
    if (!replacement.isActive) {
      throw new BusinessRuleViolationError(`入れ替え先の商品が無効です: ${replacement.code.value}`);
    }

    // B014: セット商品は入れ替え先として指定できない
    if (replacement.category.canHaveComponents()) {
      throw new BusinessRuleViolationError(
        `セット商品は入れ替え先として指定できません: ${replacement.code.value}`
      );
    }

    // B015: 参照元の周辺商品・セット構成で重複しないこと
    for (const product of referencingProducts) {
      for (const relation of product.relatedProducts) {
        if (relation.relatedProductId.equals(replacement.id)) {
          throw new BusinessRuleViolationError(
            `${product.name.value} (${product.code.value}) で重複します。`
          );
        }
      }
      for (const component of product.components) {
        if (component.componentProductId.equals(replacement.id)) {
          throw new BusinessRuleViolationError(
            `${product.name.value} (${product.code.value}) で重複します。`
          );
        }
      }
    }
  }
}
