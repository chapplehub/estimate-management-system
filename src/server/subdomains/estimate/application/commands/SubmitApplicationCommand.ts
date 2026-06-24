import { ConflictError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EmployeeQueryService } from "@subdomains/employee/application/queries/EmployeeQueryService";
import { PositionQueryService } from "@subdomains/position/application/queries/PositionQueryService";
import { ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";
import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";
import {
  Estimate,
  EstimateApplication,
  EstimateApprovalExemption,
} from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { EstimateApplicationRepository } from "@subdomains/estimate/domain/repositories/approval/EstimateApplicationRepository";
import { EstimateApprovalExemptionRepository } from "@subdomains/estimate/domain/repositories/approval/EstimateApprovalExemptionRepository";
import { type ApprovalChainBlockedReason } from "@subdomains/estimate/domain/services/approval/ApprovalChainBuilder";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { EstimateApplicationPersistError } from "../errors/EstimateApplicationPersistError";
import { assembleApprovalChain } from "../shared/approval/assembleApprovalChain";
import { loadApprovalChainInputs } from "../shared/approval/loadApprovalChainInputs";

export type SubmitApplicationInput = {
  estimateId: string;
  variationId: string;
  operatorEmployeeId: string;
  /** Preview 時に読んだ Estimate.version（TOCTOU 防御＋同時直列化の関門トークン・ADR-0068）。 */
  version: number;
};

/** 申請の結末（複数の正常結末は union・ADR-0037/0038）。 */
export type SubmitApplicationResult =
  | {
      kind: "ApplicationSubmitted";
      applicationId: string;
      finalApprovalPositionId: string;
      attempt: number;
    }
  | { kind: "ApprovalExempted"; exemptionId: string; reason: string };

function blockedMessage(reason: ApprovalChainBlockedReason): string {
  switch (reason) {
    case "NO_SUPERIOR_ROLE":
      return "申請者に上位役割が設定されていないため申請できません（§5.2）";
    case "GOAL_UNREACHABLE":
      return "必要な承認職位まで組織が届かないため申請できません（§5.2）";
    case "NO_APPROVER":
      return "承認対象役割に承認者が存在しないため申請できません（§5.2）";
  }
}

/**
 * 見積申請コマンド（version 関門で「1見積1前進」を直列化・ADR-0068・#417・§6.3）
 *
 * 単一ジェスチャで結末が2通り（承認必要なら申請＋ステップ列を作成、免除なら免除を記録）。
 * judge を再評価して分岐し（TOCTOU 防御・§6.3）、`Estimate.version` の条件付き更新を申請挿入の
 * 前段の関門に置く。兄弟チェック（逐次）と version 関門（同時）の二段で横断不変条件を担保する。
 *
 * - 順序: INACTIVE 拒否 → 兄弟前進チェック → judge 再評価 → version 関門 → 挿入。
 * - version 関門失敗（stale）は `ConflictError`（リポジトリ由来・ケース1）。
 * - 関門通過後の挿入失敗は `EstimateApplicationPersistError` で包む（ケース2）。順序が
 *   「bump → insert」なので部分失敗は無害な version 空振りに留まり、再 Preview で回復する。
 */
export class SubmitApplicationCommand {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly applicationRepository: EstimateApplicationRepository,
    private readonly exemptionRepository: EstimateApprovalExemptionRepository,
    private readonly productQueryService: ProductQueryService,
    private readonly employeeQueryService: EmployeeQueryService,
    private readonly positionQueryService: PositionQueryService,
    private readonly roleQueryService: RoleQueryService
  ) {}

  async execute(input: SubmitApplicationInput): Promise<SubmitApplicationResult> {
    const loaded = await loadApprovalChainInputs(input, {
      estimateRepository: this.estimateRepository,
      productQueryService: this.productQueryService,
      employeeQueryService: this.employeeQueryService,
      positionQueryService: this.positionQueryService,
      roleQueryService: this.roleQueryService,
    });

    // 1. INACTIVE バリエーションは申請不可（§3.4/§12）。
    if (!loaded.targetVariationIsActive) {
      throw new BusinessRuleViolationError("無効なバリエーションには申請できません");
    }

    // 2. 兄弟チェック（逐次正しさ）: 見積内に前進中のバリエーションが既にあれば弾く（1見積1前進）。
    await this.assertNoAdvancingVariation(loaded.estimate);

    // 3. judge 再評価（TOCTOU・§6.3）。
    const result = assembleApprovalChain(loaded.assemblerInput);

    // 4. BLOCKED は Preview にとっては正常結果だが、Submit は境界で業務例外へ昇格する。
    if (result.kind === "BLOCKED") {
      throw new BusinessRuleViolationError(blockedMessage(result.reason));
    }

    // 5. version 関門（ADR-0068）。通過した者だけが挿入へ進む。stale なら ConflictError（ケース1）。
    await this.estimateRepository.update(loaded.estimate, input.version);

    // 6. 関門通過後にだけ永続化。挿入失敗は EstimateApplicationPersistError で包む（ケース2）。
    const variationId = new EstimateVariationId(input.variationId);
    const operatorId = new EmployeeId(input.operatorEmployeeId);
    try {
      if (result.kind === "EXEMPT") {
        const exemption = EstimateApprovalExemption.create(variationId, result.reason, operatorId);
        const saved = await this.exemptionRepository.insert(exemption);
        return {
          kind: "ApprovalExempted",
          exemptionId: saved.id.value,
          reason: saved.reason.value,
        };
      }

      const attempt = await this.nextAttempt(variationId);
      const application = EstimateApplication.create({
        variationId,
        attempt,
        applicantEmployeeId: operatorId,
        plan: result.plan,
      });
      const saved = await this.applicationRepository.insert(application);
      return {
        kind: "ApplicationSubmitted",
        applicationId: saved.id.value,
        finalApprovalPositionId: saved.finalApprovalPositionId.value,
        attempt: saved.attempt,
      };
    } catch (error) {
      // ConflictError は insert リポジトリが P2002 を翻訳した「再試行可能な競合」（ケース1）。
      // これを PersistError（ケース2＝「申請に失敗しました」）で包むと、UI の再読込誘導・409 相当の
      // 扱いが崩れるため素通しする。それ以外の保存失敗だけを PersistError で包む（ADR-0068）。
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new EstimateApplicationPersistError(error);
    }
  }

  /** 見積配下のいずれかのバリエーションが前進中（免除済み or 申請中/承認済）なら拒否する。 */
  private async assertNoAdvancingVariation(estimate: Estimate): Promise<void> {
    for (const variation of estimate.variations) {
      const exemption = await this.exemptionRepository.findByVariationId(variation.id);
      if (exemption !== null) {
        throw new BusinessRuleViolationError(
          "既に前進しているバリエーションがあります（1見積1前進）"
        );
      }
      const applications = await this.applicationRepository.findByVariationId(variation.id);
      const hasAdvancing = applications.some((application) =>
        application.applicationStatus.isAdvancing()
      );
      if (hasAdvancing) {
        throw new BusinessRuleViolationError(
          "既に前進しているバリエーションがあります（1見積1前進）"
        );
      }
    }
  }

  /** 同一バリエーションの申請回数（初回1・差戻後は最大+1）。 */
  private async nextAttempt(variationId: EstimateVariationId): Promise<number> {
    const applications = await this.applicationRepository.findByVariationId(variationId);
    return applications.reduce((max, application) => Math.max(max, application.attempt), 0) + 1;
  }
}
