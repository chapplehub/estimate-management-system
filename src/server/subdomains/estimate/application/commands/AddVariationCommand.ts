import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate, EstimateFactory } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { checkTaxRateThenSave, type TaxCheckedSaveResult } from "../shared/checkTaxRateThenSave";
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
    private readonly taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService
  ) {}

  async execute(input: AddVariationInput): Promise<TaxCheckedSaveResult> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    const content = EstimateFactory.buildVariationContent(
      toVariationContentDescriptor(input.content)
    );
    estimate.appendVariation(content);

    return checkTaxRateThenSave(estimate, {
      taxRateConsistencyCheck: this.taxRateConsistencyCheck,
      estimateRepository: this.estimateRepository,
    });
  }
}
