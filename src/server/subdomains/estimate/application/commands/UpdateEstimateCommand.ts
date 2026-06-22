import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { EmergencyReason } from "@subdomains/estimate/domain/values/approval/EmergencyReason";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { FaultDescription } from "@subdomains/estimate/domain/values/FaultDescription";
import { TaxRoundingType } from "@subdomains/estimate/domain/values/TaxRoundingType";
import { checkTaxRateThenSave, type TaxCheckedSaveResult } from "../shared/checkTaxRateThenSave";

/** 事前修理見積詳細の更新入力（プリミティブ）。estimateType=REPAIR の見積でのみ指定する。 */
export type UpdateRepairDetailInput = {
  targetProductId: string;
  faultDescription: string;
  scheduledRepairDate: Date;
};

/** 事後修理見積詳細の更新入力（プリミティブ）。estimateType=AFTER_REPAIR の見積でのみ指定する。 */
export type UpdateAfterRepairDetailInput = {
  targetProductId: string;
  faultDescription: string;
  actualRepairDate: Date;
  emergencyReason: string;
};

/**
 * 見積ヘッダ更新コマンドの入力（すべてプリミティブ型）。
 *
 * 更新対象は集約に変更メソッドがあるヘッダ項目 + 税端数区分 + 条件付きの修理情報。
 * estimateType は採番接頭辞 N/R/A（§2.1）と 1:1 のため変更不可、createdBy は監査
 * 項目のため対象外。提出区分はバリエーション単位の不変属性（ADR-0045）のため対象外。
 *
 * 税率（taxRate）は本コマンドの入力から除外する: §8.7 の整合チェックは見積年月日・
 * 締切日から master 解決した税率で行い、利用者の自由入力値は使わないため（S3 決定・
 * 画面でも read-only）。
 *
 * 修理情報は estimateType に応じて片方のみ指定する。指定された側のみ更新する
 * （集約側が型不一致を throw でガードする）。
 */
export type UpdateEstimateInput = {
  estimateId: string;
  /** 編集画面表示時に取得した楽観ロックトークン（ADR-0039）。フォーム往復で持ち回る */
  version: number;
  estimateDate: Date;
  deadline: Date;
  customerId: string;
  deliveryLocationId: string;
  departmentId: string;
  taxRoundingType: string;
  repairDetail?: UpdateRepairDetailInput | null;
  afterRepairDetail?: UpdateAfterRepairDetailInput | null;
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
    estimate.changeCustomer(new CustomerId(input.customerId));
    estimate.changeDeliveryLocation(new DeliveryLocationId(input.deliveryLocationId));
    estimate.changeDepartment(new DepartmentId(input.departmentId));
    estimate.changeTaxRoundingType(TaxRoundingType.from(input.taxRoundingType));

    if (input.repairDetail) {
      estimate.changeRepairDetail({
        targetProductId: new ProductId(input.repairDetail.targetProductId),
        faultDescription: new FaultDescription(input.repairDetail.faultDescription),
        scheduledRepairDate: input.repairDetail.scheduledRepairDate,
      });
    }
    if (input.afterRepairDetail) {
      estimate.changeAfterRepairDetail({
        targetProductId: new ProductId(input.afterRepairDetail.targetProductId),
        faultDescription: new FaultDescription(input.afterRepairDetail.faultDescription),
        actualRepairDate: input.afterRepairDetail.actualRepairDate,
        emergencyReason: new EmergencyReason(input.afterRepairDetail.emergencyReason),
      });
    }

    return checkTaxRateThenSave(estimate, input.version, {
      taxRateConsistencyCheck: this.taxRateConsistencyCheck,
      estimateRepository: this.estimateRepository,
    });
  }
}
