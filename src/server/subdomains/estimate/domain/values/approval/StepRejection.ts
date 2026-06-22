import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { RejectionComment } from "./RejectionComment";

/**
 * 差戻イベントの値オブジェクト（§3.4）
 *
 * 「行の存在＝このステップは差戻」を写し取る不変イベント（ADR-0058）。
 * 親ステップ（`EstimateApprovalStep`）が自然キー（stepId）を所有するため、本 VO は
 * independent な identity を持たず、イベント payload（差戻者・差戻理由・差戻日時）のみを
 * 保持する。差戻理由は §3.4 で必須のため {@link RejectionComment}（空不可）で型強制する。
 */
export class StepRejection {
  private constructor(
    private readonly _rejectedByEmployeeId: EmployeeId,
    private readonly _comment: RejectionComment,
    private readonly _occurredAt: Date
  ) {}

  /** 差戻イベントを生成する。差戻者・差戻理由・差戻日時を受け取る。 */
  static create(
    rejectedByEmployeeId: EmployeeId,
    comment: RejectionComment,
    occurredAt: Date
  ): StepRejection {
    return new StepRejection(rejectedByEmployeeId, comment, occurredAt);
  }

  /** 差戻者の従業員 ID（別集約を ID 参照）。 */
  get rejectedByEmployeeId(): EmployeeId {
    return this._rejectedByEmployeeId;
  }

  /** 差戻理由（必須・§3.4）。 */
  get comment(): RejectionComment {
    return this._comment;
  }

  /** 差戻日時（イベント行の createdAt）。 */
  get occurredAt(): Date {
    return this._occurredAt;
  }

  equals(other: StepRejection): boolean {
    return (
      this._rejectedByEmployeeId.equals(other._rejectedByEmployeeId) &&
      this._comment.equals(other._comment) &&
      this._occurredAt.getTime() === other._occurredAt.getTime()
    );
  }
}
