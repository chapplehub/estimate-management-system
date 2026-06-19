import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { ApprovalChainPlan } from "../values/ApprovalChainPlan";
import { ApplicationWithdrawal } from "../values/ApplicationWithdrawal";
import { EstimateApplicationId } from "../values/EstimateApplicationId";
import { EstimateVariationId } from "../values/EstimateVariationId";
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
    if (steps.length === 0) {
      // ApprovalChainPlan が最低1役割を保証するため通常到達しない構造的バックストップ。
      throw new BusinessRuleViolationError(
        "申請は最低1つの承認ステップを持つ必要があります（§12・ADR-0003）"
      );
    }
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
}
