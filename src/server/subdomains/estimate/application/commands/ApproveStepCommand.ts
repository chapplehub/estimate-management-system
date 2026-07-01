import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EstimateApplication } from "@subdomains/estimate/domain/entities";
import { EstimateApplicationRepository } from "@subdomains/estimate/domain/repositories/approval/EstimateApplicationRepository";
import { EstimateApprovalStepId } from "@subdomains/estimate/domain/values/approval/EstimateApprovalStepId";
import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";

/**
 * ステップ承認コマンドの入力（§7.1）。
 *
 * 承認は当該承認ステップ単位の操作のため、対象特定は stepId で行う（申請ルートは
 * findByStepId で引く）。`expectedVersion` は画面表示時に取得した楽観ロックトークン
 * （ADR-0039）で、同一ステップへの承認/差戻の同時実行や最終承認と取下の競合を直列化する。
 */
export type ApproveStepInput = {
  stepId: string;
  approverEmployeeId: string;
  expectedVersion: number;
};

/**
 * ステップ承認ユースケース（§7.1）。
 *
 * 流れ: 申請ルートをロード → 承認者が当該ステップの役割メンバーであることを検証 → ドメイン
 * approve（AWAITING をガード）→ version 付きで保存。
 *
 * 権限（当該ステップの役割メンバーのみ承認可・§7.4/§12）の判定材料は estimate 集約の外にある
 * 役割グラフ（EmployeeRole）であり、ドメインにポートを持たせない規約（ADR-0030/0052）に従って
 * アプリ層で {@link RoleQueryService.hasMember} を介して検証する（取下の本人性が集約内に完結し
 * ドメインでガードするのと対称）。非メンバーは BusinessRuleViolationError で弾く。
 *
 * 単一集約の更新1回で完結し原子性は repo.update 内の runAtomically が担保するため
 * TransactionRunner は注入しない。stale な expectedVersion は infra の ConflictError（ADR-0039）を
 * 握り潰さず伝播する。
 */
export class ApproveStepCommand {
  constructor(
    private readonly applicationRepository: EstimateApplicationRepository,
    private readonly roleQueryService: RoleQueryService
  ) {}

  async execute(input: ApproveStepInput): Promise<EstimateApplication> {
    const stepId = new EstimateApprovalStepId(input.stepId);
    const application = await this.applicationRepository.findByStepId(stepId);
    if (!application) {
      throw new NotFoundEntityError(EstimateApplication, { stepId: input.stepId });
    }

    const step = application.steps.find((candidate) => candidate.id.equals(stepId));
    if (!step) {
      // findByStepId が返した集約には当該ステップが必ず含まれる（多層防御）。
      throw new NotFoundEntityError(EstimateApplication, { stepId: input.stepId });
    }

    const isMember = await this.roleQueryService.hasMember(
      step.roleId.value,
      input.approverEmployeeId
    );
    if (!isMember) {
      throw new BusinessRuleViolationError(
        "承認者は当該ステップの役割メンバーではないため承認できません（§7.4）"
      );
    }

    application.approve(stepId, new EmployeeId(input.approverEmployeeId));

    return this.applicationRepository.update(application, input.expectedVersion);
  }
}
