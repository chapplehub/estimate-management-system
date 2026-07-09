import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate, EstimateFactory } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";
import { assertSetComponentsValid } from "../shared/assertSetComponentsValid";
import { checkTaxRateThenSave, type TaxCheckedSaveResult } from "../shared/checkTaxRateThenSave";
import {
  resolveLineTreePrices,
  type ExistingLinePrice,
  type LinePriceContext,
  type SellingPriceResolver,
} from "../shared/resolveLinePrices";
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
  /** 編集画面表示時に取得した親見積の楽観ロックトークン（ADR-0039）。フォーム往復で持ち回る */
  version: number;
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
    private readonly taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService,
    private readonly productQueryService: ProductQueryService,
    /**
     * 明細生成時の見積単価を権威解決する価格決定（#428・ADR-0064）。入力の単価は受け取らず、
     * 商品選択＝明細生成としてここで解決・固定する。C4 全置換の既存行保全は次段で配線する。
     */
    private readonly resolveSellingPrice: SellingPriceResolver
  ) {}

  async execute(input: UpdateVariationInput): Promise<TaxCheckedSaveResult> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    // 内容の見積単価を価格決定で解決する（ADR-0064）。提出区分は対象バリエーションの不変属性
    // （ADR-0045）、宛先・見積年月日は親見積から取る。
    const target = estimate.variations.find((v) => v.id.value === input.variationId);
    if (!target) {
      throw new NotFoundEntityError(Estimate, { id: input.variationId });
    }
    const context: LinePriceContext = {
      submissionType: target.submissionType,
      customerId: estimate.customerId.value,
      deliveryLocationId: estimate.deliveryLocationId.value,
      estimateDate: estimate.estimateDate,
    };
    // C4 全置換の既存行保全（ADR-20260709-5ea）: 現行明細の永続単価を itemId で索引する。
    // ペイロード行が同一 itemId かつ productId 不変なら再解決せず永続値を保つ（設計判断 B）。
    // target.items は通常明細・セット構成明細の双方を含むため、両者の保全がこれで賄える。
    const existingLines = new Map<string, ExistingLinePrice>(
      target.items.map((item) => [
        item.id.value,
        { productId: item.productId.value, unitPrice: item.unitPrice },
      ])
    );
    const priceMap = await resolveLineTreePrices(
      input.content,
      context,
      this.resolveSellingPrice,
      existingLines
    );

    const content = EstimateFactory.buildVariationContent(
      toVariationContentDescriptor(input.content, priceMap)
    );
    // セット群の構成について区分・有効性をライブ検証（ADR-0052・ペイロード防御）。
    // 区分外（セット商品ネスト等）はここで BusinessRuleViolationError として弾く。
    await assertSetComponentsValid(content, this.productQueryService);
    estimate.updateVariation(new EstimateVariationId(input.variationId), content);

    return checkTaxRateThenSave(estimate, input.version, {
      taxRateConsistencyCheck: this.taxRateConsistencyCheck,
      estimateRepository: this.estimateRepository,
    });
  }
}
