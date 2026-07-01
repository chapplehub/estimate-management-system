import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EstimateApplication } from "@subdomains/estimate/domain/entities";
import { EstimateApplicationRepository } from "@subdomains/estimate/domain/repositories/approval/EstimateApplicationRepository";
import { EstimateApprovalStepId } from "@subdomains/estimate/domain/values/approval/EstimateApprovalStepId";
import { RejectionComment } from "@subdomains/estimate/domain/values/approval/RejectionComment";
import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";
import { loadStepForMemberDecision } from "../shared/approval/loadStepForMemberDecision";

/**
 * ステップ差戻コマンドの入力（§7.2）。
 *
 * 承認と同じく対象特定は stepId で行い、差戻は必須の理由コメントを伴う。`comment` は生文字列で
 * 受け、コマンド内で {@link RejectionComment} を構築する（空/超過は VO が ValidationError を投げる・
 * 必須・1〜2000字・trim）。`expectedVersion` は楽観ロックトークン（ADR-0039）。
 */
export type RejectStepInput = {
  stepId: string;
  rejecterEmployeeId: string;
  comment: string;
  expectedVersion: number;
};

/**
 * ステップ差戻ユースケース（§7.2）。
 *
 * 流れ: 申請ルートをロード → 差戻者が当該ステップの役割メンバーであることを検証 → コメント VO を
 * 構築 → ドメイン reject（AWAITING をガード）→ version 付きで保存。承認（{@link ApproveStepCommand}）と
 * 骨格は同一で、差戻は必須コメントを伴う点だけが異なる。
 *
 * 権限（当該ステップの役割メンバーのみ差戻可・§7.4/§12）は集約外の役割グラフを要するため、
 * ドメインにポートを持たせずアプリ層で {@link RoleQueryService.hasMember} を介して検証する
 * （ADR-0030/0052）。非メンバーは BusinessRuleViolationError で弾く。単一集約の更新1回で完結し
 * 原子性は repo.update 内の runAtomically が担保するため TransactionRunner は注入しない。stale な
 * expectedVersion は infra の ConflictError（ADR-0039）を握り潰さず伝播する。
 */
export class RejectStepCommand {
  constructor(
    private readonly applicationRepository: EstimateApplicationRepository,
    private readonly roleQueryService: RoleQueryService
  ) {}

  async execute(input: RejectStepInput): Promise<EstimateApplication> {
    const stepId = new EstimateApprovalStepId(input.stepId);
    const application = await loadStepForMemberDecision({
      applicationRepository: this.applicationRepository,
      roleQueryService: this.roleQueryService,
      stepId,
      operatorEmployeeId: input.rejecterEmployeeId,
      operationLabel: "差戻",
    });

    application.reject(
      stepId,
      new EmployeeId(input.rejecterEmployeeId),
      new RejectionComment(input.comment)
    );

    return this.applicationRepository.update(application, input.expectedVersion);
  }
}
