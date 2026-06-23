import { InvalidArgumentError } from "@server/shared/errors/DomainError";
import { EmployeeQueryService } from "@subdomains/employee/application/queries/EmployeeQueryService";
import { PositionQueryService } from "@subdomains/position/application/queries/PositionQueryService";
import { ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";
import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { assembleApprovalChain } from "../shared/approval/assembleApprovalChain";
import { loadApprovalChainInputs } from "../shared/approval/loadApprovalChainInputs";
import {
  type PreviewApplicationResultDTO,
  type PreviewApplicationStepDTO,
} from "./dto/PreviewApplicationResultDTO";

export type PreviewApplicationInput = {
  estimateId: string;
  variationId: string;
  operatorEmployeeId: string;
};

/**
 * 申請プレビュークエリ（確認モーダル用・§6.2・#417）
 *
 * 対象バリエーションについて「免除されるか／どの承認チェーンになるか／申請できない理由は何か」を
 * 副作用なしで返す。`SubmitApplication`（コマンド）と同じ越境ローダー＋純粋アセンブラを共有し、
 * judge・組織スナップショット組立て・チェーン構築のロジックを一箇所に保つ（ドリフト防止）。
 *
 * 承認必要（REQUIRED）の場合、計画の役割 ID 列をローダーが取得済みの役割DTOで表示名へ解決し、
 * ゴール役職名と起点→ゴール順のステップ列を組み立てる。
 */
export class PreviewApplicationQuery {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly productQueryService: ProductQueryService,
    private readonly employeeQueryService: EmployeeQueryService,
    private readonly positionQueryService: PositionQueryService,
    private readonly roleQueryService: RoleQueryService
  ) {}

  async execute(input: PreviewApplicationInput): Promise<PreviewApplicationResultDTO> {
    const loaded = await loadApprovalChainInputs(input, {
      estimateRepository: this.estimateRepository,
      productQueryService: this.productQueryService,
      employeeQueryService: this.employeeQueryService,
      positionQueryService: this.positionQueryService,
      roleQueryService: this.roleQueryService,
    });

    const result = assembleApprovalChain(loaded.assemblerInput);

    if (result.kind === "EXEMPT") {
      return { kind: "EXEMPT", reason: result.reason.value, reasonLabel: result.reason.label };
    }
    if (result.kind === "BLOCKED") {
      return { kind: "BLOCKED", reason: result.reason };
    }

    // REQUIRED: 役割 ID 列を表示名へ解決する（起点→ゴール順）。
    const roleById = new Map(loaded.roleDtos.map((dto) => [dto.id, dto]));
    const steps: PreviewApplicationStepDTO[] = result.plan.roleIds.map((roleId, index) => {
      const dto = roleById.get(roleId.value);
      if (dto === undefined) {
        // ローダーは全役割を読み込むため、計画の役割が引けないのは内部不整合（バグ）。
        throw new InvalidArgumentError(
          `承認ステップの役割が役割一覧に見つかりません（roleId: ${roleId.value}）`
        );
      }
      return { order: index + 1, roleName: dto.name, positionName: dto.positionName };
    });

    return {
      kind: "REQUIRED",
      goalPositionId: result.plan.goalPositionId.value,
      goalPositionName: steps[steps.length - 1].positionName,
      steps,
    };
  }
}
