import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EstimateApprovalExemptionId } from "../../values/approval/EstimateApprovalExemptionId";
import { EstimateExemptionReason } from "../../values/approval/EstimateExemptionReason";
import { EstimateVariationId } from "../../values/EstimateVariationId";

/**
 * 承認免除集約ルート（§3.5 / §8・ADR-0054）
 *
 * 承認不要（消耗品のみ／10万円未満／事後見積）と判定された見積バリエーションの確定を
 * 表す、薄い独立集約。承認チェーン（`EstimateApplication`）とは別概念のため別集約ルート
 * とする（ADR-0054）。1バリエーション1免除（schema の単純ユニーク）。
 *
 * 免除は生成後に状態が変わらない不変レコード（承認/差戻のような決定遷移を持たない）。
 * よって状態変更 API を持たず、`create`（新規確定）と `reconstruct`（永続化復元）のみ提供する。
 * 免除日時は業務日時として createdAt に集約する（§3.5）。
 */
export class EstimateApprovalExemption {
  private constructor(
    private readonly _id: EstimateApprovalExemptionId,
    private readonly _variationId: EstimateVariationId,
    private readonly _reason: EstimateExemptionReason,
    private readonly _exemptedByEmployeeId: EmployeeId,
    private readonly _createdAt: Date
  ) {}

  /**
   * 承認免除を新規確定する。id は UUIDv7 を採番し、免除日時は現在時刻を記録する。
   * 免除理由は §4.2 の判定（ApprovalRequirementPolicy）に由来する。
   */
  static create(
    variationId: EstimateVariationId,
    reason: EstimateExemptionReason,
    exemptedByEmployeeId: EmployeeId
  ): EstimateApprovalExemption {
    return new EstimateApprovalExemption(
      EstimateApprovalExemptionId.generate(),
      variationId,
      reason,
      exemptedByEmployeeId,
      new Date()
    );
  }

  /** 永続化から復元する。 */
  static reconstruct(input: {
    id: EstimateApprovalExemptionId;
    variationId: EstimateVariationId;
    reason: EstimateExemptionReason;
    exemptedByEmployeeId: EmployeeId;
    createdAt: Date;
  }): EstimateApprovalExemption {
    return new EstimateApprovalExemption(
      input.id,
      input.variationId,
      input.reason,
      input.exemptedByEmployeeId,
      input.createdAt
    );
  }

  get id(): EstimateApprovalExemptionId {
    return this._id;
  }

  /** 免除対象バリエーション（別集約を ID 参照）。 */
  get variationId(): EstimateVariationId {
    return this._variationId;
  }

  get reason(): EstimateExemptionReason {
    return this._reason;
  }

  /** 免除を実施した従業員 ID（別集約を ID 参照）。 */
  get exemptedByEmployeeId(): EmployeeId {
    return this._exemptedByEmployeeId;
  }

  /** 免除日時（業務日時 = createdAt・§3.5）。 */
  get createdAt(): Date {
    return this._createdAt;
  }
}
