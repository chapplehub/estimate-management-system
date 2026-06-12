import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { checkTaxRateThenSave, type TaxCheckedSaveResult } from "../shared/checkTaxRateThenSave";

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
 * （全複写・deliveryPrice スナップショット・系譜・凍結はドメインの責務）→ §8.6/§8.7 の
 * 税率チェック → 保存。税率不一致なら保存せず Result（taxRateMismatch）を返す。
 *
 * C6 複製（集約またぎ・採番あり）と異なり採番は行わず、同一集約の update で完結する。
 * 改訂系譜は集約の内側にあり（ADR-0044）、保存は update の差分 upsert が担う。
 */
export class ReviseForCustomerCommand {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService
  ) {}

  async execute(input: ReviseForCustomerInput): Promise<TaxCheckedSaveResult> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    estimate.reviseForCustomer(new EstimateVariationId(input.sourceVariationId));

    return checkTaxRateThenSave(estimate, input.version, {
      taxRateConsistencyCheck: this.taxRateConsistencyCheck,
      estimateRepository: this.estimateRepository,
    });
  }
}
