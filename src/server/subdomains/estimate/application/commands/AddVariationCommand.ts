import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate, EstimateFactory } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { checkTaxRateThenSave, type TaxCheckedSaveResult } from "../shared/checkTaxRateThenSave";
import {
  resolveLineTreePrices,
  type LinePriceContext,
  type SellingPriceResolver,
} from "../shared/resolveLinePrices";
import {
  toVariationContentDescriptor,
  type VariationContentInput,
} from "../shared/variationContentInput";

/**
 * バリエーション追加コマンドの入力。
 *
 * バリエーション番号は集約が max+1 で自動採番する（§A.2）ため入力に含めない。
 */
export type AddVariationInput = {
  estimateId: string;
  /**
   * 編集画面表示時に取得した親見積の楽観ロックトークン（ADR-0039）。
   * 追加型コマンドでも必須とする。差分 upsert（ADR-0032）は集約に無い子を deleteMany で
   * 消すため、stale な集約からの保存が並行追加された他人のバリエーションを削除しうる。
   */
  version: number;
  /** 提出区分（"CUSTOMER" / "DELIVERY_LOCATION"）。作成時に確定する不変属性（ADR-0045）のため content と別に受け取る */
  submissionType: string;
  content: VariationContentInput;
};

/**
 * バリエーション追加コマンド（C3）。
 *
 * 既存集約をロード → 番号なし内容を子エンティティへ構築（EstimateFactory）→ 集約ルートが
 * max+1 採番して追加（appendVariation）→ §8.6/§8.7 の税率チェック→保存。
 * 税率不一致なら保存せず Result（taxRateMismatch）を返す。見積不在は NotFoundEntityError。
 */
export class AddVariationCommand {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService,
    /**
     * 明細生成時の見積単価を権威解決する価格決定（#428・ADR-0064）。入力の単価は受け取らず、
     * 商品選択＝明細生成としてここで解決・固定する。追加バリエーションは全行が新規＝全解決。
     */
    private readonly resolveSellingPrice: SellingPriceResolver
  ) {}

  async execute(input: AddVariationInput): Promise<TaxCheckedSaveResult> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    // 追加明細の見積単価を価格決定で解決する（ADR-0064）。提出区分は入力で確定する不変属性
    // （ADR-0045）、宛先・見積年月日は親見積から取る。追加は全行が新規のため既存行保全はなし。
    const context: LinePriceContext = {
      submissionType: SubmissionType.from(input.submissionType),
      customerId: estimate.customerId.value,
      deliveryLocationId: estimate.deliveryLocationId.value,
      estimateDate: estimate.estimateDate,
    };
    const priceMap = await resolveLineTreePrices(input.content, context, this.resolveSellingPrice);

    const content = EstimateFactory.buildVariationContent(
      toVariationContentDescriptor(input.content, priceMap)
    );
    estimate.appendVariation(content, SubmissionType.from(input.submissionType));

    return checkTaxRateThenSave(estimate, input.version, {
      taxRateConsistencyCheck: this.taxRateConsistencyCheck,
      estimateRepository: this.estimateRepository,
    });
  }
}
