import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { CommonSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CommonSellingPriceRepository";
import { CommonSellingPricePeriodId } from "@subdomains/pricing/domain/values/CommonSellingPricePeriodId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

export type DeleteCommonSellingPricePeriodInput = {
  productId: string;
  periodId: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める。 */
  referenceDate: string;
  /** 編集画面表示時の version（楽観ロック・ADR-0039）。 */
  expectedVersion: number;
};

/**
 * 共通売単価の未来開始行を削除するコマンド（誤入力の訂正）。
 *
 * 現在有効・失効の行は過去そのもの／既発行見積が時点解決した履歴のため削除できない。状態違反は
 * 集約の不変条件が `BusinessRuleViolationError` で弾く（参照日に依存・ADR-20260627-86b）。
 */
export class DeleteCommonSellingPricePeriodCommand {
  constructor(private readonly repository: CommonSellingPriceRepository) {}

  async execute(input: DeleteCommonSellingPricePeriodInput): Promise<CommonSellingPrice> {
    const productId = new ProductId(input.productId);
    const aggregate = await this.repository.findByProductId(productId);
    if (aggregate === null) {
      throw new NotFoundEntityError(CommonSellingPrice, { productId: input.productId });
    }

    aggregate.deletePeriod(new CommonSellingPricePeriodId(input.periodId), input.referenceDate);

    await this.repository.update(aggregate, input.expectedVersion);
    return aggregate;
  }
}
