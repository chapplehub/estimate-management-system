import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";

/**
 * 取下イベントの値オブジェクト（§3.4）
 *
 * 「行の存在＝この申請は取下」を写し取る不変イベント（ADR-0058）。取下は申請レベルの
 * イベントで、親集約ルート（`EstimateApplication`）が自然キー（applicationId）を所有する
 * ため、本 VO は independent な identity を持たず、イベント payload（取下者・取下日時）
 * のみを保持する。発生日時はイベント行の `createdAt` に対応する。
 */
export class ApplicationWithdrawal {
  private constructor(
    private readonly _withdrawnByEmployeeId: EmployeeId,
    private readonly _occurredAt: Date
  ) {}

  /** 取下イベントを生成する。取下者と取下日時を受け取る。 */
  static create(withdrawnByEmployeeId: EmployeeId, occurredAt: Date): ApplicationWithdrawal {
    return new ApplicationWithdrawal(withdrawnByEmployeeId, occurredAt);
  }

  /** 取下者の従業員 ID（別集約を ID 参照）。 */
  get withdrawnByEmployeeId(): EmployeeId {
    return this._withdrawnByEmployeeId;
  }

  /** 取下日時（イベント行の createdAt）。 */
  get occurredAt(): Date {
    return this._occurredAt;
  }

  equals(other: ApplicationWithdrawal): boolean {
    return (
      this._withdrawnByEmployeeId.equals(other._withdrawnByEmployeeId) &&
      this._occurredAt.getTime() === other._occurredAt.getTime()
    );
  }
}
