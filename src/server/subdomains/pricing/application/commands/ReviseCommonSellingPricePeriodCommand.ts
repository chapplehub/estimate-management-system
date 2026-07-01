import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { CommonSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CommonSellingPriceRepository";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { loadCommonSellingPriceOrThrow } from "./loadCommonSellingPriceOrThrow";

export type ReviseCommonSellingPricePeriodInput = {
  productId: string;
  /** 改定日（＝現在有効行の適用終了日＝新行の適用開始日。今日より後・JST 暦日）。 */
  revisionDate: string;
  /** 改定後の単価。通貨スケール固定の10進文字列（float を経由しない・ADR-0022）。 */
  price: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める（ADR-20260627-86b）。 */
  referenceDate: string;
  /** 編集画面表示時の version（楽観ロック・ADR-0039）。 */
  expectedVersion: number;
};

/**
 * 共通売単価を改定日から新単価へ切り替えるコマンド（単価改定）。
 *
 * 改定は新しい原子操作ではなく「現在有効行の適用終了（終了日＝改定日）」＋「改定日開始の新規期間追加」
 * の合成糖衣（CONTEXT.md `単価改定`）。1ロードした集約に両ミューテータを順適用し1セーブすることで、
 * 単一集約 version の楽観ロックでアトミック性（部分適用なし）を担保する。各原子操作は ADR-20260627-86b
 * の温度ガード（適用終了＝終了日>今日／追加＝開始≥今日）を持つため、過去日改定の遡及改竄は構造的に閉じる。
 *
 * 適用終了→追加の順で呼ぶ（逆順だと旧行が現在有効行のまま新行と接触判定され重複しうる）。
 * 現在有効行が無い（未設定・失効のみ）商品は改定対象が無く {@link BusinessRuleViolationError} で拒否する。
 */
export class ReviseCommonSellingPricePeriodCommand {
  constructor(private readonly repository: CommonSellingPriceRepository) {}

  async execute(input: ReviseCommonSellingPricePeriodInput): Promise<CommonSellingPrice> {
    const aggregate = await loadCommonSellingPriceOrThrow(this.repository, input.productId);

    const current = aggregate.currentValidPeriod(input.referenceDate);
    if (current === undefined) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}の改定には現在有効な単価が必要です（未設定・失効の商品は新規登録から行ってください）`
      );
    }

    const newPrice = SellingUnitPrice.fromMoney(Money.fromDecimalString(input.price));

    aggregate.endDatePeriod(current.id, input.revisionDate, input.referenceDate);
    aggregate.addPeriod(
      ApplicablePeriod.create({ start: input.revisionDate, end: null }),
      newPrice,
      input.referenceDate
    );

    await this.repository.update(aggregate, input.expectedVersion);
    return aggregate;
  }
}
