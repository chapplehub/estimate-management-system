import { InvalidArgumentError } from "@server/shared/errors/DomainError";
import { EmployeeQueryService } from "@subdomains/employee/application/queries/EmployeeQueryService";
import { PositionQueryService } from "@subdomains/position/application/queries/PositionQueryService";
import { ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";
import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { BLOCKED_REASON_LABELS } from "@subdomains/estimate/domain/services/approval/ApprovalChainBuilder";
import { assembleApprovalChain } from "../shared/approval/assembleApprovalChain";
import { loadApprovalChainInputs } from "../shared/approval/loadApprovalChainInputs";
import {
  resolveUnitPriceDivergences,
  type UnitPriceDivergenceResolver,
} from "../shared/resolveUnitPriceDivergences";
import {
  type PreviewApplicationResultDTO,
  type PreviewApplicationStepDTO,
  type UnitPriceWarningDTO,
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
    private readonly roleQueryService: RoleQueryService,
    private readonly divergenceResolver: UnitPriceDivergenceResolver
  ) {}

  async execute(input: PreviewApplicationInput): Promise<PreviewApplicationResultDTO> {
    const loaded = await loadApprovalChainInputs(input, {
      estimateRepository: this.estimateRepository,
      productQueryService: this.productQueryService,
      employeeQueryService: this.employeeQueryService,
      positionQueryService: this.positionQueryService,
      roleQueryService: this.roleQueryService,
    });

    // INACTIVE バリエーションは申請不可（§3.4/§12）。Submit（SubmitApplicationCommand）と同じく
    // `targetVariationIsActive` を判定の起点に置き、judge＋チェーン組立ての前に弾く。これを
    // 怠ると Preview だけが INACTIVE でも EXEMPT/REQUIRED を見せ、Submit と可否が食い違う（#442）。
    if (!loaded.targetVariationIsActive) {
      // canApply ゲートが INACTIVE を弾くため、ここへ到達する＝表示後に無効化されたレース。
      // ユーザーに画面更新を促す固定文言を BE から載せる（表示文言は BE 所有・ADR-0069）。
      return {
        kind: "INACTIVE",
        label: "このバリエーションは無効化されています。画面を更新して最新の状態をご確認ください。",
      };
    }

    const result = assembleApprovalChain(loaded.assemblerInput);

    // BLOCKED は申請できないため警告は添えない（EXEMPT/REQUIRED の申請可能 preview のみ・#593）。
    if (result.kind === "BLOCKED") {
      return {
        kind: "BLOCKED",
        reason: result.reason,
        reasonLabel: BLOCKED_REASON_LABELS[result.reason],
      };
    }

    const unitPriceWarning = await this.countUnitPriceWarnings(loaded.estimate, input.variationId);

    if (result.kind === "EXEMPT") {
      return {
        kind: "EXEMPT",
        reason: result.reason.value,
        reasonLabel: result.reason.label,
        unitPriceWarning,
      };
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
      unitPriceWarning,
    };
  }

  /**
   * 対象バリエーションの価格付き末端行を見積年月日基準で再解決・突合し、単価乖離・解決不能の件数を数える
   * （Step 2 と同じ {@link resolveUnitPriceDivergences} を共有。ドリフトしない）。宛先・見積年月日は
   * ヘッダ不変属性、提出区分はバリエーション固定なので、この単位でのデデュープが「提出区分×商品ID」になる。
   */
  private async countUnitPriceWarnings(
    estimate: Estimate,
    variationId: string
  ): Promise<UnitPriceWarningDTO> {
    const variation = estimate.variations.find((v) => v.id.value === variationId);
    // ローダーが対象バリエーションの存在を保証済み。念のため無ければ警告なし。
    if (variation === undefined) {
      return { divergentCount: 0, unresolvableCount: 0 };
    }

    const divergences = await resolveUnitPriceDivergences(
      variation.items.map((item) => ({
        productId: item.productId.value,
        fixedUnitPrice: item.unitPrice.majorUnits,
      })),
      {
        submissionType: variation.submissionType,
        customerId: estimate.customerId.value,
        deliveryLocationId: estimate.deliveryLocationId.value,
        estimateDate: estimate.estimateDate,
      },
      this.divergenceResolver
    );

    return {
      divergentCount: divergences.filter((d) => d.kind === "DIVERGENT").length,
      unresolvableCount: divergences.filter((d) => d.kind === "UNRESOLVABLE").length,
    };
  }
}
