import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductRepository } from "@subdomains/product/domain/repositories/ProductRepository";
import { ProductReplacementDomainService } from "@subdomains/product/domain/services/ProductReplacementDomainService";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

export type DeactivateProductWithReplacementInput = {
  id: string;
  /** 画面表示時の version（楽観ロック / ADR-0039） */
  expectedVersion: number;
  replacementCode: string;
};

/**
 * 商品無効化+入れ替えコマンド
 *
 * 対象商品を無効化し、周辺商品・セット構成での参照を
 * 入れ替え先商品に一括置換する。
 */
export class DeactivateProductWithReplacementCommand {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly productReplacementDomainService: ProductReplacementDomainService
  ) {}

  async execute(input: DeactivateProductWithReplacementInput): Promise<Product> {
    const targetId = new ProductId(input.id);
    const target = await this.productRepository.findById(targetId);
    if (!target) {
      throw new NotFoundEntityError(Product, { id: input.id });
    }

    // 入れ替え先商品をコードで検索
    const replacementCode = new ProductCode(input.replacementCode);
    const replacement = await this.productRepository.findByCode(replacementCode);
    if (!replacement) {
      throw new NotFoundEntityError(Product, { code: input.replacementCode });
    }

    // 対象商品を参照している商品を取得
    const referencingProducts = await this.productRepository.findReferencingProducts(targetId);

    // ド���インサービスで入れ替え先の妥当性を検証（B013/B014/B015）
    this.productReplacementDomainService.validateReplacement(
      targetId,
      replacement,
      referencingProducts
    );

    // 対象商品を無効化。競合（ConflictError）はここで発生するため、
    // 後続の参照置換を含め何も変更される前に中断される（#322 の前提）
    target.deactivate();
    await this.productRepository.update(target, input.expectedVersion);

    // 周辺商品・セット構成の参照を一括置換
    await this.productRepository.replaceInRelationsAndComponents(targetId, replacement.id);

    return target;
  }
}
