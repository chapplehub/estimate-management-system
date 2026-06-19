import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate, type ItemPriceAdjustment } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { DiscountRate } from "@subdomains/estimate/domain/values/DiscountRate";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateItemId } from "@subdomains/estimate/domain/values/EstimateItemId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { Memo } from "@subdomains/estimate/domain/values/Memo";
import { Money } from "@subdomains/estimate/domain/values/Money";
import { checkTaxRateThenSave, type TaxCheckedSaveResult } from "../shared/checkTaxRateThenSave";

/** 明細単位の調整入力（#390）。価格系（単価・掛率・明細値引）＋メモ。数量・商品は持たない。 */
export type AdjustRevisedVariationItemInput = {
  itemId: string;
  /** 単価（円・整数）。 */
  unitPrice: number;
  /** 掛率（例 1.0=値引なし、0.95=5%引き）。 */
  discountRate: number;
  /** 明細値引（円・整数）。 */
  itemDiscount: number;
  customerMemo?: string;
  internalMemo?: string;
};

/**
 * 改訂先バリエーションの部分編集コマンドの入力（#390）。
 *
 * 改訂先の編集可能集合は「単価・掛率・明細値引・全体値引・メモ（バリ＋明細）」（ADR-0060）。
 * 商品・数量・改訂価格・行構成は固定のため入力に持たない。集約は estimateId からのみ
 * ロードできるため対象特定に variationId を併せて受け取る。
 */
export type AdjustRevisedVariationInput = {
  estimateId: string;
  variationId: string;
  /** 編集画面表示時に取得した親見積の楽観ロックトークン（ADR-0039）。フォーム往復で持ち回る */
  version: number;
  /** 全体値引（円・整数）。 */
  overallDiscount: number;
  customerMemo?: string;
  internalMemo?: string;
  items: AdjustRevisedVariationItemInput[];
};

/**
 * 改訂先バリエーションの部分編集コマンド（#390）。
 *
 * 流れ: 既存集約をロード → ルート adjustVariationPricing で価格系（明細の単価・掛率・
 * 明細値引＋全体値引）を一括適用 → バリ単位・明細単位のメモを適用 → §8.6/§8.7 の
 * 税率チェック→保存。改訂先は editableVariationOrThrow で凍結改訂元を弾きつつ通る。
 *
 * 価格変更で税額が動くため、メモのみ更新（ADR-0059・素の update）とは別に
 * checkTaxRateThenSave（C2/C3/C4 と同じ）を通す。予測可能な業務分岐（税率不一致）は
 * Result で返し、見積不在は NotFoundEntityError を throw する（ADR-0037）。
 */
export class AdjustRevisedVariationCommand {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService
  ) {}

  async execute(input: AdjustRevisedVariationInput): Promise<TaxCheckedSaveResult> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    const variationId = new EstimateVariationId(input.variationId);

    const adjustments: ItemPriceAdjustment[] = input.items.map((item) => ({
      itemId: new EstimateItemId(item.itemId),
      unitPrice: Money.fromMajorUnits(item.unitPrice),
      discountRate: new DiscountRate(item.discountRate),
      itemDiscount: Money.fromMajorUnits(item.itemDiscount),
    }));
    estimate.adjustVariationPricing(
      variationId,
      adjustments,
      Money.fromMajorUnits(input.overallDiscount)
    );

    // メモは金額に効かないため価格適用後に重ねて適用する（ADR-0059 と同じ正規化）。
    estimate.changeVariationMemos(
      variationId,
      Memo.create(input.customerMemo),
      Memo.create(input.internalMemo)
    );
    for (const item of input.items) {
      estimate.changeItemMemos(
        variationId,
        new EstimateItemId(item.itemId),
        Memo.create(item.customerMemo),
        Memo.create(item.internalMemo)
      );
    }

    return checkTaxRateThenSave(estimate, input.version, {
      taxRateConsistencyCheck: this.taxRateConsistencyCheck,
      estimateRepository: this.estimateRepository,
    });
  }
}
