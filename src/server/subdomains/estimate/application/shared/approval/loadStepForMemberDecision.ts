import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { EstimateApplication } from "@subdomains/estimate/domain/entities";
import { EstimateApplicationRepository } from "@subdomains/estimate/domain/repositories/approval/EstimateApplicationRepository";
import { EstimateApprovalStepId } from "@subdomains/estimate/domain/values/approval/EstimateApprovalStepId";
import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";

/**
 * stepId 起点の申請ルートをロードし、操作者が当該ステップの役割メンバーであることを検証して
 * 申請アグリゲートを返す（承認 §7.1・差戻 §7.2 の共通前処理）。
 *
 * 承認/差戻はどちらも「当該ステップの役割メンバーのみが操作できる」認可（§7.4/§12）を持ち、
 * その判定材料は estimate 集約の外にある役割グラフ（EmployeeRole）であるため、ドメインにポートを
 * 持たせずアプリ層で {@link RoleQueryService.hasMember} を介して検証する（ADR-0030/0052）。両コマンドで
 * 骨格が同一のため本ヘルパーに集約し、操作固有の差分（差戻のコメント VO 構築など）は呼び出し側に残す。
 *
 * @param operationLabel エラーメッセージに用いる操作名（例: "承認" / "差戻"）。
 * @throws NotFoundEntityError stepId に対応する申請ルートが存在しない場合。
 * @throws BusinessRuleViolationError 操作者が当該ステップの役割メンバーでない場合。
 */
export async function loadStepForMemberDecision(deps: {
  applicationRepository: EstimateApplicationRepository;
  roleQueryService: RoleQueryService;
  stepId: EstimateApprovalStepId;
  operatorEmployeeId: string;
  operationLabel: string;
}): Promise<EstimateApplication> {
  const { applicationRepository, roleQueryService, stepId, operatorEmployeeId, operationLabel } =
    deps;

  const application = await applicationRepository.findByStepId(stepId);
  if (!application) {
    throw new NotFoundEntityError(EstimateApplication, { stepId: stepId.value });
  }

  const step = application.steps.find((candidate) => candidate.id.equals(stepId));
  if (!step) {
    // findByStepId が返した集約には当該ステップが必ず含まれる（多層防御）。
    throw new NotFoundEntityError(EstimateApplication, { stepId: stepId.value });
  }

  const isMember = await roleQueryService.hasMember(step.roleId.value, operatorEmployeeId);
  if (!isMember) {
    throw new BusinessRuleViolationError(
      `操作者は当該ステップの役割メンバーではないため${operationLabel}できません（§7.4）`
    );
  }

  return application;
}
