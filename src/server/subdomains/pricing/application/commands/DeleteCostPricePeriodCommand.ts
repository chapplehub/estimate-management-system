import { CostPrice } from "@subdomains/pricing/domain/entities";
import { CostPriceRepository } from "@subdomains/pricing/domain/repositories/CostPriceRepository";
import { CostPricePeriodId } from "@subdomains/pricing/domain/values/CostPricePeriodId";
import { loadCostPriceOrThrow } from "./loadCostPriceOrThrow";

export type DeleteCostPricePeriodInput = {
  productId: string;
  periodId: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める。 */
  referenceDate: string;
  /** 編集画面表示時の version（楽観ロック・ADR-0039）。 */
  expectedVersion: number;
};

/**
 * 原価の未来開始行を削除するコマンド（誤入力の訂正）。
 *
 * 現在有効・失効の行は過去そのもの／既発行見積が時点解決した履歴のため削除できない。状態違反は
 * 集約の不変条件が `BusinessRuleViolationError` で弾く（参照日に依存・ADR-20260627-86b）。
 */
export class DeleteCostPricePeriodCommand {
  constructor(private readonly repository: CostPriceRepository) {}

  async execute(input: DeleteCostPricePeriodInput): Promise<CostPrice> {
    const aggregate = await loadCostPriceOrThrow(this.repository, input.productId);

    aggregate.deletePeriod(new CostPricePeriodId(input.periodId), input.referenceDate);

    await this.repository.update(aggregate, input.expectedVersion);
    return aggregate;
  }
}
