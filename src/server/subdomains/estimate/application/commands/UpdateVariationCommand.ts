import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate, EstimateFactory } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { checkTaxRateThenSave, type TaxCheckedSaveResult } from "../shared/checkTaxRateThenSave";
import {
  toVariationContentDescriptor,
  type VariationContentInput,
} from "../shared/variationContentInput";

/**
 * バリエーション更新コマンドの入力。
 *
 * 集約はリポジトリで estimateId からのみロードできるため、対象特定に estimateId と
 * variationId の両方を受け取る。バリエーション番号は更新対象外（変更しない）。
 */
export type UpdateVariationInput = {
  estimateId: string;
  variationId: string;
  content: VariationContentInput;
};

/**
 * バリエーション更新コマンド（C4）。
 *
 * 既存集約をロード → 番号なし内容を子エンティティへ構築（EstimateFactory）→ 集約ルートが
 * 対象バリエーションの内容を宣言的に全置換（updateVariation → replaceContent）→ §8.6/§8.7
 * の税率チェック→保存。§3.4「無効状態は編集不可」は replaceContent 内で
 * BusinessRuleViolationError として弾く。見積不在は NotFoundEntityError。
 */
export class UpdateVariationCommand {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService
  ) {}

  async execute(input: UpdateVariationInput): Promise<TaxCheckedSaveResult> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    const content = EstimateFactory.buildVariationContent(
      toVariationContentDescriptor(input.content)
    );
    estimate.updateVariation(new EstimateVariationId(input.variationId), content);

    return checkTaxRateThenSave(estimate, {
      taxRateConsistencyCheck: this.taxRateConsistencyCheck,
      estimateRepository: this.estimateRepository,
    });
  }
}
