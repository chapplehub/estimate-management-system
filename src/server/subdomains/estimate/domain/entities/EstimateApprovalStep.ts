import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { EstimateApprovalStepId } from "../values/EstimateApprovalStepId";
import { StepApproval } from "../values/StepApproval";
import { StepRejection } from "../values/StepRejection";

/**
 * 承認ステップ子エンティティ（§3.3・ADR-0002）
 *
 * 申請時に全ステップを事前生成する（ADR-0002）。骨格（役割・ステップ順）は完全不変で、
 * 承認/差戻の結果は終端イベント VO（{@link StepApproval} / {@link StepRejection}）として
 * 後から付与される。「行の存在＝決定」をメモリ上では「VO が non-null＝発生」で写し取る
 * （ADR-0058）。独自 UUID を持つ（終端イベント VO がこの id を自然キーとして借りる）。
 *
 * 集約境界規約（ADR-0027）により本エンティティは entities バレルから export せず、
 * 集約ルート `EstimateApplication` のファクトリ／メソッド経由でのみ生成・操作される。
 *
 * 本ステップの述語（isApproved/isRejected）は自ステップの決定の有無のみを見るローカル判定。
 * 「承認待ち（AWAITING）か」のような下位ステップ横断の状態導出は集約ルートが担う（§3.6）。
 */
export class EstimateApprovalStep {
  private constructor(
    private readonly _id: EstimateApprovalStepId,
    private readonly _stepOrder: number,
    private readonly _roleId: RoleId,
    private _approval: StepApproval | null,
    private _rejection: StepRejection | null
  ) {}

  /**
   * 新規ステップ骨格を生成する（集約ルートの事前生成から呼ばれる）。決定はまだ無い。
   */
  static create(roleId: RoleId, stepOrder: number): EstimateApprovalStep {
    return new EstimateApprovalStep(
      EstimateApprovalStepId.generate(),
      stepOrder,
      roleId,
      null,
      null
    );
  }

  /** 永続化から復元する（決定イベントの有無を含む）。 */
  static reconstruct(input: {
    id: EstimateApprovalStepId;
    stepOrder: number;
    roleId: RoleId;
    approval: StepApproval | null;
    rejection: StepRejection | null;
  }): EstimateApprovalStep {
    return new EstimateApprovalStep(
      input.id,
      input.stepOrder,
      input.roleId,
      input.approval,
      input.rejection
    );
  }

  get id(): EstimateApprovalStepId {
    return this._id;
  }

  /** ステップ順（1 始まりの連番・§3.3）。 */
  get stepOrder(): number {
    return this._stepOrder;
  }

  /** 承認対象役割（別集約を ID 参照）。 */
  get roleId(): RoleId {
    return this._roleId;
  }

  /** 承認イベント（未承認なら null）。 */
  get approval(): StepApproval | null {
    return this._approval;
  }

  /** 差戻イベント（未差戻なら null）。 */
  get rejection(): StepRejection | null {
    return this._rejection;
  }

  /**
   * 承認イベントを付与する（集約ルートの approve から呼ばれる）。1ステップ1決定の
   * 構造的不変条件として、既に決定済みのステップへの再付与は拒否する。承認待ち（AWAITING）
   * かどうかの順序ガードは集約ルートが §3.6 導出で行う。
   */
  recordApproval(approval: StepApproval): void {
    if (this.isDecided()) {
      throw new BusinessRuleViolationError(
        "既に決定済みの承認ステップに決定を付与することはできません"
      );
    }
    this._approval = approval;
  }

  /**
   * 差戻イベントを付与する（集約ルートの reject から呼ばれる）。既に決定済みのステップへの
   * 再付与は拒否する（1ステップ1決定）。
   */
  recordRejection(rejection: StepRejection): void {
    if (this.isDecided()) {
      throw new BusinessRuleViolationError(
        "既に決定済みの承認ステップに決定を付与することはできません"
      );
    }
    this._rejection = rejection;
  }

  /** このステップが承認済か（ローカル判定）。 */
  isApproved(): boolean {
    return this._approval !== null;
  }

  /** このステップが差戻済か（ローカル判定）。 */
  isRejected(): boolean {
    return this._rejection !== null;
  }

  /** このステップに決定（承認 or 差戻）が付いているか。 */
  isDecided(): boolean {
    return this.isApproved() || this.isRejected();
  }
}
