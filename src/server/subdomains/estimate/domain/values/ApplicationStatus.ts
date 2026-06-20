import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"] as const;
type ApplicationStatusValue = (typeof VALID_VALUES)[number];

const LABEL_MAP: Record<ApplicationStatusValue, string> = {
  PENDING: "申請中",
  APPROVED: "承認済",
  REJECTED: "差戻",
  WITHDRAWN: "取下",
};

/**
 * 申請の導出状態の値オブジェクト（§3.6）
 *
 * **保存しない**。申請の状態は終端イベント行（取下／差戻／承認）の存在と承認ステップの
 * 進行から導出する（ADR-0058）。Prisma に `ApplicationStatus` enum 列は存在せず、本 VO は
 * 集約ルート `EstimateApplication` の導出計算（§3.6）と読み取りモデルが結果を型で
 * 表現するためのメモリ上の値である。
 *
 * 導出規則（§3.6・上から評価し最初に一致）:
 * - 取下行あり → WITHDRAWN（最優先）
 * - いずれかのステップに差戻行 → REJECTED
 * - 全ステップに承認行 → APPROVED
 * - 上記いずれも無し → PENDING
 */
export class ApplicationStatus extends ValueObject<string, "ApplicationStatus"> {
  static readonly PENDING = new ApplicationStatus("PENDING");
  static readonly APPROVED = new ApplicationStatus("APPROVED");
  static readonly REJECTED = new ApplicationStatus("REJECTED");
  static readonly WITHDRAWN = new ApplicationStatus("WITHDRAWN");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  /** 業務表示名（「申請中」/「承認済」/「差戻」/「取下」）。 */
  get label(): string {
    return LABEL_MAP[this._value as ApplicationStatusValue];
  }

  /** 承認待ち（取下可能な状態・§7.3）。 */
  isPending(): boolean {
    return this === ApplicationStatus.PENDING;
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as ApplicationStatusValue)) {
      throw new ValidationError(
        `不正な申請状態です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }
}
