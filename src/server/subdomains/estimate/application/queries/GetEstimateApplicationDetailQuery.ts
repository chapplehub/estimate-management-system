import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";
import {
  type ApplicationOperationsView,
  type EstimateApplicationDetailDTO,
} from "./dto/EstimateApplicationDetailDTO";
import {
  type ApplicationOperationFacts,
  type EstimateApplicationDetailProjection,
  type EstimateApplicationDetailQueryService,
} from "./EstimateApplicationDetailQueryService";

export type GetEstimateApplicationDetailInput = {
  estimateNumber: string;
  variationNumber: number;
  /** 操作者（ログイン社員）の従業員 ID。操作可否の合成に使う。 */
  operatorEmployeeId: string;
};

/** 操作不可（免除・非 PENDING・操作者が無権限）のときの operations（全 false・標的 null）。 */
const NO_OPERATIONS: ApplicationOperationsView = {
  canApprove: false,
  canReject: false,
  canWithdraw: false,
  latestApplicationId: null,
  awaitingStepId: null,
  expectedVersion: null,
};

/**
 * 見積申請詳細 参照クエリ（app 層・#573・ADR-20260707-ae2）
 *
 * query service（操作者非依存）が返す projection を受け、operator から操作可否 `operations` を合成して
 * 最終 DTO を組み立てる。合成材料のうち役割メンバーシップ（`canApprove`/`canReject`）は role サブ
 * ドメインの `RoleQueryService.hasMember` を介して判定し、estimate infra から role 表を直読みしない
 * （集約境界・ADR-0030/0052）。本人性（`canWithdraw`）も含め、操作可否の合成を app 層 1 箇所に集約する。
 *
 * NotFound（見積番号なし／バリエーション番号なし／申請も免除も無い）は projection が null になり、
 * そのまま null を返す（一覧の母集合と整合）。
 */
export class GetEstimateApplicationDetailQuery {
  constructor(
    private readonly queryService: EstimateApplicationDetailQueryService,
    private readonly roleQueryService: RoleQueryService
  ) {}

  async execute(
    input: GetEstimateApplicationDetailInput
  ): Promise<EstimateApplicationDetailDTO | null> {
    const projection = await this.queryService.findDetail(
      input.estimateNumber,
      input.variationNumber
    );
    if (projection === null) {
      return null;
    }

    const operations = await this.composeOperations(
      projection.operationFacts,
      input.operatorEmployeeId
    );

    return this.toDTO(projection, operations);
  }

  /**
   * 操作可否を合成する。「状態＝申請中（PENDING）」を共通ゲートに、
   * - `canWithdraw` = 操作者が申請者本人
   * - `canApprove` = `canReject` = 操作者が承認待ちステップの役割メンバー（`hasMember`）
   * を組み立てる。非 PENDING（免除含む）は全 false・標的 null（{@link NO_OPERATIONS}）。
   */
  private async composeOperations(
    facts: ApplicationOperationFacts,
    operatorEmployeeId: string
  ): Promise<ApplicationOperationsView> {
    if (!facts.isPending) {
      return NO_OPERATIONS;
    }

    const canWithdraw = facts.applicantEmployeeId === operatorEmployeeId;
    const isAwaitingMember =
      facts.awaitingRoleId !== null &&
      (await this.roleQueryService.hasMember(facts.awaitingRoleId, operatorEmployeeId));

    return {
      canApprove: isAwaitingMember,
      canReject: isAwaitingMember,
      canWithdraw,
      latestApplicationId: facts.latestApplicationId,
      awaitingStepId: facts.awaitingStepId,
      expectedVersion: facts.expectedVersion,
    };
  }

  /** projection（operationFacts を含む）から operationFacts を落とし、operations を載せた最終 DTO に整形する。 */
  private toDTO(
    projection: EstimateApplicationDetailProjection,
    operations: ApplicationOperationsView
  ): EstimateApplicationDetailDTO {
    if (projection.kind === "APPLICATIONS") {
      return {
        kind: "APPLICATIONS",
        summary: projection.summary,
        latest: projection.latest,
        past: projection.past,
        operations,
      };
    }
    return {
      kind: "EXEMPTED",
      summary: projection.summary,
      exemption: projection.exemption,
      operations,
    };
  }
}
