import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { ApplicationStatus } from "../../values/approval/ApplicationStatus";
import { ApprovalChainPlan } from "../../values/approval/ApprovalChainPlan";
import { ApprovalStepStatus } from "../../values/approval/ApprovalStepStatus";
import { ApplicationWithdrawal } from "../../values/approval/ApplicationWithdrawal";
import { EstimateApplicationId } from "../../values/approval/EstimateApplicationId";
import { EstimateApprovalStepId } from "../../values/approval/EstimateApprovalStepId";
import { EstimateVariationId } from "../../values/EstimateVariationId";
import { RejectionComment } from "../../values/approval/RejectionComment";
import { StepApproval } from "../../values/approval/StepApproval";
import { StepRejection } from "../../values/approval/StepRejection";
import { EstimateApprovalStep } from "./EstimateApprovalStep";

/**
 * 見積申請集約ルート（§2.2 / §3.2・ADR-0002/0027/0036/0058）
 *
 * 申請とその承認ステップ・各決定イベント・取下イベントを完全に支配する集約。状態
 * （PENDING/APPROVED/REJECTED/WITHDRAWN）は保存せず、終端イベント行の存在と順序から
 * 導出する（ADR-0058・§3.6 は着手順序 Step 6 で実装）。
 *
 * **集約境界規約（ADR-0027）**: 本ルートのみ entities バレルから（ファクトリとともに）
 * 公開し、子エンティティ `EstimateApprovalStep` は集約外から直接生成・操作できない。
 * チェーン構築サービス（services/）も子を直接生成せず、VO 計画 {@link ApprovalChainPlan}
 * を本ファクトリへ渡す（ADR-0036）。
 *
 * **構造的不変条件（§12・ADR-0029）**:
 * - 承認ステップを1件以上持つ。
 * - `finalApprovalPositionId` は NOT NULL。
 * - `stepOrder` は 1 から連番。
 *
 * **楽観ロック**: アグリゲート変更の直列化に用いる `version` はエンティティに保持せず、
 * リポジトリ更新時に `expectedVersion` 引数として渡す（ADR-0039）。
 */
export class EstimateApplication {
  private constructor(
    private readonly _id: EstimateApplicationId,
    private readonly _variationId: EstimateVariationId,
    private readonly _attempt: number,
    private readonly _applicantEmployeeId: EmployeeId,
    private readonly _finalApprovalPositionId: PositionId,
    private readonly _steps: EstimateApprovalStep[],
    private _withdrawal: ApplicationWithdrawal | null
  ) {}

  /**
   * 申請を新規生成する（集約内ファクトリ・ADR-0036）。
   *
   * チェーン計画（{@link ApprovalChainPlan}）の役割列から全承認ステップを事前生成し
   * （ADR-0002）、stepOrder を 1 始まりの連番で付与する。ゴール役職は計画が解決済みの
   * `goalPositionId` を `finalApprovalPositionId` として採る。`attempt` は同一バリエーションの
   * 過去申請の最大 +1（初回 1）をアプリ層が算出して渡す（§6.3）。
   */
  static create(input: {
    variationId: EstimateVariationId;
    attempt: number;
    applicantEmployeeId: EmployeeId;
    plan: ApprovalChainPlan;
  }): EstimateApplication {
    const steps = input.plan.roleIds.map((roleId, index) =>
      EstimateApprovalStep.create(roleId, index + 1)
    );
    return new EstimateApplication(
      EstimateApplicationId.generate(),
      input.variationId,
      input.attempt,
      input.applicantEmployeeId,
      input.plan.goalPositionId,
      steps,
      null
    );
  }

  /** 永続化から復元する（事前生成済みステップ・取下イベントの有無を含む）。 */
  static reconstruct(input: {
    id: EstimateApplicationId;
    variationId: EstimateVariationId;
    attempt: number;
    applicantEmployeeId: EmployeeId;
    finalApprovalPositionId: PositionId;
    steps: EstimateApprovalStep[];
    withdrawal: ApplicationWithdrawal | null;
  }): EstimateApplication {
    return new EstimateApplication(
      input.id,
      input.variationId,
      input.attempt,
      input.applicantEmployeeId,
      input.finalApprovalPositionId,
      input.steps,
      input.withdrawal
    );
  }

  get id(): EstimateApplicationId {
    return this._id;
  }

  /** 申請対象バリエーション（別集約を ID 参照）。 */
  get variationId(): EstimateVariationId {
    return this._variationId;
  }

  /** 申請回数（同一バリエーションへの通番・差戻再申請で +1・§3.2）。 */
  get attempt(): number {
    return this._attempt;
  }

  /** 申請者の従業員 ID（別集約を ID 参照）。 */
  get applicantEmployeeId(): EmployeeId {
    return this._applicantEmployeeId;
  }

  /** 承認フローのゴール役職（金額から算出・NOT NULL・ADR-0055）。 */
  get finalApprovalPositionId(): PositionId {
    return this._finalApprovalPositionId;
  }

  /** 承認ステップ列（stepOrder 昇順・読み取り専用ビュー）。 */
  get steps(): ReadonlyArray<Readonly<EstimateApprovalStep>> {
    return [...this._steps];
  }

  /** 取下イベント（未取下なら null）。 */
  get withdrawal(): ApplicationWithdrawal | null {
    return this._withdrawal;
  }

  // ========================================
  // 状態導出（§3.6・保存せず行の存在から導出・ADR-0058）
  // ========================================

  /**
   * 申請の導出状態（§3.6・上から評価し最初に一致）:
   * - 取下行あり → WITHDRAWN（最優先）
   * - いずれかのステップに差戻行 → REJECTED
   * - 全ステップに承認行 → APPROVED
   * - 上記いずれも無し → PENDING
   *
   * ステップ単体の決定（isApproved/isRejected）と取下イベントのみから決まり、
   * ステップ状態導出（{@link stepStatus}）には依存しないため循環しない。
   */
  get applicationStatus(): ApplicationStatus {
    if (this._withdrawal !== null) {
      return ApplicationStatus.WITHDRAWN;
    }
    if (this._steps.some((step) => step.isRejected())) {
      return ApplicationStatus.REJECTED;
    }
    if (this._steps.every((step) => step.isApproved())) {
      return ApplicationStatus.APPROVED;
    }
    return ApplicationStatus.PENDING;
  }

  /**
   * 指定ステップの導出状態（§3.6・上から評価し最初に一致）:
   * - 差戻行あり → REJECTED
   * - 承認行あり → APPROVED
   * - 決定なし＋下位 stepOrder が全て承認済＋申請 PENDING → AWAITING
   * - 決定なし＋下位に未承認あり（または申請が PENDING でない）→ NOT_STARTED
   */
  stepStatus(stepId: EstimateApprovalStepId): ApprovalStepStatus {
    const step = this.findStep(stepId);
    if (step.isRejected()) {
      return ApprovalStepStatus.REJECTED;
    }
    if (step.isApproved()) {
      return ApprovalStepStatus.APPROVED;
    }
    if (!this.applicationStatus.isPending()) {
      return ApprovalStepStatus.NOT_STARTED;
    }
    const lowerAllApproved = this._steps
      .filter((other) => other.stepOrder < step.stepOrder)
      .every((other) => other.isApproved());
    return lowerAllApproved ? ApprovalStepStatus.AWAITING : ApprovalStepStatus.NOT_STARTED;
  }

  // ========================================
  // 承認・差戻・取下（§7・ガードは導出状態で表現）
  // ========================================

  /**
   * ステップを承認する（§7.1）。当該ステップが承認待ち（AWAITING）であることを §3.6 導出で
   * ガードし、承認イベントを付与する。最終ステップの承認で申請は導出上 APPROVED になる。
   */
  approve(stepId: EstimateApprovalStepId, approverEmployeeId: EmployeeId): void {
    const step = this.findStep(stepId);
    this.assertStepAwaiting(stepId);
    step.recordApproval(StepApproval.create(approverEmployeeId, new Date()));
  }

  /**
   * ステップを差し戻す（§7.2）。当該ステップが承認待ち（AWAITING）であることをガードし、
   * 差戻イベント（必須コメント付き）を付与する。これにより申請は導出上 REJECTED になる。
   */
  reject(
    stepId: EstimateApprovalStepId,
    rejectedByEmployeeId: EmployeeId,
    comment: RejectionComment
  ): void {
    const step = this.findStep(stepId);
    this.assertStepAwaiting(stepId);
    step.recordRejection(StepRejection.create(rejectedByEmployeeId, comment, new Date()));
  }

  /**
   * 申請を取り下げる（§7.3）。申請が承認待ち（PENDING）であることをガードし、取下イベントを
   * 付与する。これにより申請は導出上 WITHDRAWN（最優先）になる。
   */
  withdraw(withdrawnByEmployeeId: EmployeeId): void {
    if (!this.applicationStatus.isPending()) {
      throw new BusinessRuleViolationError(
        "承認待ち（PENDING）でない申請は取り下げできません（§7.3）"
      );
    }
    this._withdrawal = ApplicationWithdrawal.create(withdrawnByEmployeeId, new Date());
  }

  private assertStepAwaiting(stepId: EstimateApprovalStepId): void {
    if (!this.stepStatus(stepId).isAwaiting()) {
      throw new BusinessRuleViolationError(
        "承認待ち（AWAITING）でないステップは承認・差戻できません（§7.1/§7.2）"
      );
    }
  }

  private findStep(stepId: EstimateApprovalStepId): EstimateApprovalStep {
    const step = this._steps.find((candidate) => candidate.id.equals(stepId));
    if (step === undefined) {
      throw new BusinessRuleViolationError("指定された承認ステップはこの申請に存在しません");
    }
    return step;
  }
}
