import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRoundingType } from "@subdomains/estimate/domain/values/TaxRoundingType";
import { checkTaxRateThenSave, type TaxCheckedSaveResult } from "../shared/checkTaxRateThenSave";

/**
 * 見積ヘッダ更新コマンドの入力（すべてプリミティブ型）。
 *
 * 更新対象は集約に変更メソッドがあるヘッダ 6 項目 + 税率系 2 項目。estimateType は
 * 採番接頭辞 N/R/A（§2.1）と 1:1 のため変更不可、createdBy は監査項目のため対象外。
 */
export type UpdateEstimateInput = {
  estimateId: string;
  /** 編集画面表示時に取得した楽観ロックトークン（ADR-0039）。フォーム往復で持ち回る */
  version: number;
  estimateDate: Date;
  deadline: Date;
  submissionType: string;
  customerId: string;
  deliveryLocationId: string;
  departmentId: string;
  taxRate: number;
  taxRoundingType: string;
};

/**
 * 見積ヘッダ更新コマンド（C2）。
 *
 * 既存集約をロード → ヘッダ値オブジェクトを適用（税率変更時は全バリエーション再計算が
 * ADR-0028 で自動実行）→ §8.6/§8.7 の税率チェック→保存（checkTaxRateThenSave）。
 * 税率不一致なら保存せず Result（taxRateMismatch）を返す。見積不在は NotFoundEntityError。
 *
 * 注: §4.8「受注作成後は編集不可」は Estimate↔Order リンク未実装のため本コマンドでは
 * 未ガード（別イシューで対応）。
 */
export class UpdateEstimateCommand {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService
  ) {}

  async execute(input: UpdateEstimateInput): Promise<TaxCheckedSaveResult> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    estimate.changeEstimateDate(input.estimateDate);
    estimate.changeDeadline(input.deadline);
    estimate.changeSubmissionType(SubmissionType.from(input.submissionType));
    estimate.changeCustomer(new CustomerId(input.customerId));
    estimate.changeDeliveryLocation(new DeliveryLocationId(input.deliveryLocationId));
    estimate.changeDepartment(new DepartmentId(input.departmentId));
    estimate.changeTaxRate(new TaxRate(input.taxRate));
    estimate.changeTaxRoundingType(TaxRoundingType.from(input.taxRoundingType));

    return checkTaxRateThenSave(estimate, input.version, {
      taxRateConsistencyCheck: this.taxRateConsistencyCheck,
      estimateRepository: this.estimateRepository,
    });
  }
}
