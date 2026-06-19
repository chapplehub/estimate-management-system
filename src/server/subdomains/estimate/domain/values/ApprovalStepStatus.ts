import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = ["NOT_STARTED", "AWAITING", "APPROVED", "REJECTED"] as const;
type ApprovalStepStatusValue = (typeof VALID_VALUES)[number];

const LABEL_MAP: Record<ApprovalStepStatusValue, string> = {
  NOT_STARTED: "未着手",
  AWAITING: "承認待ち",
  APPROVED: "承認済",
  REJECTED: "差戻",
};

/**
 * 承認ステップの導出状態の値オブジェクト（§3.6）
 *
 * **保存しない**。ステップの状態は決定イベント行（承認／差戻）の存在と、下位 stepOrder の
 * 進行・申請の状態から導出する（ADR-0058）。Prisma に `ApprovalStepStatus` enum 列は
 * 存在せず、本 VO は集約ルート `EstimateApplication` の導出計算（§3.6）が結果を型で
 * 表現するためのメモリ上の値である。
 *
 * 導出規則（§3.6・上から評価し最初に一致）:
 * - 差戻行あり → REJECTED
 * - 承認行あり → APPROVED
 * - 決定行なし＋下位 stepOrder が全て承認済＋申請 PENDING → AWAITING
 * - 決定行なし＋下位に未承認あり → NOT_STARTED
 */
export class ApprovalStepStatus extends ValueObject<string, "ApprovalStepStatus"> {
  static readonly NOT_STARTED = new ApprovalStepStatus("NOT_STARTED");
  static readonly AWAITING = new ApprovalStepStatus("AWAITING");
  static readonly APPROVED = new ApprovalStepStatus("APPROVED");
  static readonly REJECTED = new ApprovalStepStatus("REJECTED");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  /** 業務表示名（「未着手」/「承認待ち」/「承認済」/「差戻」）。 */
  get label(): string {
    return LABEL_MAP[this._value as ApprovalStepStatusValue];
  }

  /** 承認待ち（承認/差戻の操作対象・§7.1/§7.2）。 */
  isAwaiting(): boolean {
    return this === ApprovalStepStatus.AWAITING;
  }

  /** 導出結果文字列から生成する（読み取りモデル用。永続化列ではない）。 */
  static from(value: string): ApprovalStepStatus {
    switch (value) {
      case "NOT_STARTED":
        return ApprovalStepStatus.NOT_STARTED;
      case "AWAITING":
        return ApprovalStepStatus.AWAITING;
      case "APPROVED":
        return ApprovalStepStatus.APPROVED;
      case "REJECTED":
        return ApprovalStepStatus.REJECTED;
      default:
        throw new ValidationError(
          `不正な承認ステップ状態です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
        );
    }
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as ApprovalStepStatusValue)) {
      throw new ValidationError(
        `不正な承認ステップ状態です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }
}
