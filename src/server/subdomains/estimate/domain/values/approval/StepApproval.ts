import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";

/**
 * 承認イベントの値オブジェクト（§3.4）
 *
 * 「行の存在＝このステップは承認済」を写し取る不変イベント（ADR-0058）。
 * 親ステップ（`EstimateApprovalStep`）が自然キー（stepId）を所有するため、本 VO は
 * independent な identity を持たず、`EstimateVariationCopy`（ADR-0041）と同型の
 * イベント payload（承認者・承認日時）のみを保持する。発生日時はイベント行の
 * `createdAt` に対応する。
 */
export class StepApproval {
  private constructor(
    private readonly _approverEmployeeId: EmployeeId,
    private readonly _occurredAt: Date
  ) {}

  /** 承認イベントを生成する。承認者と承認日時を受け取る。 */
  static create(approverEmployeeId: EmployeeId, occurredAt: Date): StepApproval {
    return new StepApproval(approverEmployeeId, occurredAt);
  }

  /** 承認者の従業員 ID（別集約を ID 参照）。 */
  get approverEmployeeId(): EmployeeId {
    return this._approverEmployeeId;
  }

  /** 承認日時（イベント行の createdAt）。 */
  get occurredAt(): Date {
    return this._occurredAt;
  }

  equals(other: StepApproval): boolean {
    return (
      this._approverEmployeeId.equals(other._approverEmployeeId) &&
      this._occurredAt.getTime() === other._occurredAt.getTime()
    );
  }
}
