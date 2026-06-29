import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { CommonSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CommonSellingPriceRepository";
import { CommonSellingPricePeriodId } from "@subdomains/pricing/domain/values/CommonSellingPricePeriodId";
import { loadCommonSellingPriceOrThrow } from "./loadCommonSellingPriceOrThrow";

export type EndDateCommonSellingPricePeriodInput = {
  productId: string;
  periodId: string;
  /** 適用終了日（今日より後・JST 暦日）。 */
  endDate: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める。 */
  referenceDate: string;
  /** 編集画面表示時の version（楽観ロック・ADR-0039）。 */
  expectedVersion: number;
};

/**
 * 共通売単価の現在有効行を適用終了するコマンド（end-dating・独立コマンド）。
 *
 * 単価・開始日は変えず終了日のみ未来方向に確定する。入力が `{ periodId, endDate }` のみで将来行の
 * 全項目編集とは形が異なるため独立コマンドにする（ADR-0018 流・ADR-20260627-86b 軸4）。現在有効行
 * 以外への適用終了や今日以前の終了日は集約の不変条件が `BusinessRuleViolationError` で弾く。
 */
export class EndDateCommonSellingPricePeriodCommand {
  constructor(private readonly repository: CommonSellingPriceRepository) {}

  async execute(input: EndDateCommonSellingPricePeriodInput): Promise<CommonSellingPrice> {
    const aggregate = await loadCommonSellingPriceOrThrow(this.repository, input.productId);

    aggregate.endDatePeriod(
      new CommonSellingPricePeriodId(input.periodId),
      input.endDate,
      input.referenceDate
    );

    await this.repository.update(aggregate, input.expectedVersion);
    return aggregate;
  }
}
