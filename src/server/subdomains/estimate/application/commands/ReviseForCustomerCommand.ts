import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate, type RevisedUnitPriceMap } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { checkTaxRateThenSave, type TaxCheckedSaveResult } from "../shared/checkTaxRateThenSave";
import { toSellingPriceTarget, type SellingPriceResolver } from "../shared/resolveLinePrices";
import {
  resolveUnitPricesOrReject,
  type UnitPriceResolutionRequest,
} from "../shared/resolveUnitPricesOrReject";

/**
 * 得意先改訂コマンドの入力。
 *
 * 改訂先の内容は改訂元からの全複写でドメインが決定するため、入力は改訂元の指定のみ。
 * バリエーション番号は集約が max+1 で自動採番する（§A.2）。
 */
export type ReviseForCustomerInput = {
  estimateId: string;
  /** 改訂元（納品先宛・ACTIVE）のバリエーション ID。 */
  sourceVariationId: string;
  /**
   * 編集画面表示時に取得した親見積の楽観ロックトークン（ADR-0039）。
   * 追加型コマンドでも必須とする（C3 と同じ理由: 差分 upsert が stale な集約からの
   * 保存で並行追加された他人のバリエーションを削除しうるため）。
   */
  version: number;
};

/**
 * 得意先改訂コマンド（C7・集約内の縦スライス・§7.2）。
 *
 * 流れ: 既存集約をロード → reviseForCustomer で得意先宛の新バリエーションを集約内に生成
 * （改訂先の内容決定・deliveryPrice スナップショット・系譜・凍結はドメインの責務。率＝掛率とメモは
 * 改訂元から複写、単価は得意先宛で再解決、固定値引はクリア・ADR-20260714-pv8）→ §8.6/§8.7 の
 * 税率チェック → 保存。税率不一致なら保存せず Result（taxRateMismatch）を返す。
 *
 * C6 複製（集約またぎ・採番あり）と異なり採番は行わず、同一集約の update で完結する。
 * 改訂系譜は集約の内側にあり（ADR-0044）、保存は update の差分 upsert が担う。
 */
export class ReviseForCustomerCommand {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService,
    /**
     * 改訂先明細の見積単価を権威解決する価格決定（#428・#431）。改訂元単価は引き継がず、
     * 改訂先の宛先（得意先宛固定）・見積の見積年月日で解決し直す。
     */
    private readonly resolveSellingPrice: SellingPriceResolver
  ) {}

  async execute(input: ReviseForCustomerInput): Promise<TaxCheckedSaveResult> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    const sourceVariationId = new EstimateVariationId(input.sourceVariationId);

    // 改訂先明細の見積単価を価格決定で一括解決する（#431）。改訂先は得意先宛固定のため
    // 得意先宛・見積の見積年月日で解決し、1明細でも解決不能なら書き込み前に商品名を列挙して拒否する。
    const resolvedUnitPrices = await this.resolveRevisionPrices(estimate, sourceVariationId);

    estimate.reviseForCustomer(sourceVariationId, resolvedUnitPrices);

    return checkTaxRateThenSave(estimate, input.version, {
      taxRateConsistencyCheck: this.taxRateConsistencyCheck,
      estimateRepository: this.estimateRepository,
    });
  }

  /**
   * 改訂元バリエーションの全明細の見積単価を、得意先宛・見積の見積年月日で一括解決する。
   * キーは商品ID（改訂先は得意先宛固定のため提出区分は不要）で、ドメインの参照キーと一致させる。
   * 改訂元が見つからない場合は空マップを返し、reviseForCustomer 側の存在チェックに委ねる。
   */
  private async resolveRevisionPrices(
    estimate: Estimate,
    sourceVariationId: EstimateVariationId
  ): Promise<RevisedUnitPriceMap> {
    const source = estimate.variations.find((v) => v.id.equals(sourceVariationId));
    if (!source) {
      return new Map();
    }
    const requests: UnitPriceResolutionRequest[] = source.items.map((item) => ({
      key: item.productId.value,
      productName: item.itemName.value,
      target: toSellingPriceTarget(item.productId.value, {
        // 改訂先は得意先宛固定（ADR-0045）。宛先は見積の得意先、見積年月日は見積のもの。
        submissionType: SubmissionType.CUSTOMER,
        customerId: estimate.customerId.value,
        deliveryLocationId: estimate.deliveryLocationId.value,
        estimateDate: estimate.estimateDate,
      }),
    }));
    return resolveUnitPricesOrReject(requests, this.resolveSellingPrice);
  }
}
