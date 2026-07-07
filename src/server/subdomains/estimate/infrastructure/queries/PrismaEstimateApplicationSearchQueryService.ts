import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";
import { EstimateApplicationSearchQueryService } from "@subdomains/estimate/application/queries/EstimateApplicationSearchQueryService";
import { EstimateApplicationSummaryDTO } from "@subdomains/estimate/application/queries/dto/EstimateApplicationSummaryDTO";
import {
  EstimateApplicationListOptions,
  EstimateApplicationSearchCriteria,
} from "@subdomains/estimate/application/queries/dto/EstimateApplicationSearchCriteria";
import {
  selectApplicationRows,
  type DerivedSearchConditions,
  type ReducedApplicationRow,
} from "@subdomains/estimate/application/queries/selectApplicationRows";
import { deriveApplicationStatus } from "@subdomains/estimate/domain/values/approval/deriveApplicationStatus";
import { deriveAwaitingStepOrder } from "@subdomains/estimate/domain/values/approval/deriveAwaitingStepOrder";
import { VariationApplicationState } from "@subdomains/estimate/domain/values/approval/VariationApplicationState";

/**
 * 見積申請一覧の読み取り select 定義。バリエーションごとに、不変事実（見積番号・得意先名・納品先名・
 * 提出区分・税込金額）と、状態導出に必要な最小射影（免除の免除者/免除日時、各申請の attempt・
 * 申請者・申請日時・取下有無・各ステップの承認/差戻行の存在と役割）を引く。状態は保存しないため
 * （ADR-0058）、終端イベント行の存在有無だけを select する（ADR-20260707-b36）。
 */
const VARIATION_SEARCH_SELECT = {
  id: true,
  variationNumber: true,
  submissionType: true,
  finalTotal: true,
  estimate: {
    select: {
      estimateNumber: true,
      customer: { select: { name: true } },
      deliveryLocation: { select: { name: true } },
    },
  },
  // 免除は存在＋出自（免除者名・免除日時）を引く（1バリエーション高々1件・ADR-0054）。
  exemption: {
    select: {
      createdAt: true,
      exemptedBy: { select: { name: true } },
    },
  },
  applications: {
    select: {
      attempt: true,
      createdAt: true,
      applicant: { select: { name: true } },
      // 取下イベント（申請レベル・高々1）の存在。
      withdrawal: { select: { applicationId: true } },
      steps: {
        select: {
          stepOrder: true,
          roleId: true,
          role: { select: { name: true } },
          approval: { select: { stepId: true } },
          rejection: { select: { stepId: true } },
        },
      },
    },
  },
} satisfies Prisma.EstimateVariationSelect;

type VariationSearchRow = Prisma.EstimateVariationGetPayload<{
  select: typeof VARIATION_SEARCH_SELECT;
}>;
type ApplicationRow = VariationSearchRow["applications"][number];

/**
 * EstimateApplicationSearchQueryService の Prisma 実装（CQRS read model・#571・ADR-20260707-b36）。
 *
 * 集約を再構築せず Prisma を直読みし、不変事実（見積番号・得意先名・納品先名・有効/無効・申請or免除の
 * 存在）だけを where で絞る。取得は終端イベント行の存在という最小射影で、そこから先は**書き込みと共有の
 * ドメイン純粋関数**で還元する:
 * - 各申請の状態は {@link deriveApplicationStatus}（§3.6）、
 * - バリエーション単位は {@link VariationApplicationState.reduce}（免除最優先→最新attempt→未申請）、
 * - 承認待ちステップは {@link deriveAwaitingStepOrder}（PENDING 前提で承認行の無い最小 stepOrder）。
 *
 * 導出条件（状態・申請者・承認待ち役割・申請日時）は還元後の行に {@link selectApplicationRows} で
 * 適用し、固定順で安定ソートして先頭 limit 件を切り出す（limit は DB take ではなくフィルタ後）。
 */
export class PrismaEstimateApplicationSearchQueryService implements EstimateApplicationSearchQueryService {
  async search(
    criteria: EstimateApplicationSearchCriteria,
    options?: EstimateApplicationListOptions
  ): Promise<EstimateApplicationSummaryDTO[]> {
    const variations = await prisma.estimateVariation.findMany({
      where: PrismaEstimateApplicationSearchQueryService.buildWhereClause(criteria),
      select: VARIATION_SEARCH_SELECT,
    });

    // 書き込みと共有の純粋関数で還元済み行に畳む（状態・承認待ち・出自）。
    const rows = variations.map((variation) =>
      PrismaEstimateApplicationSearchQueryService.reduceRow(variation)
    );

    // 導出条件のフィルタ＋固定ソート＋limit はアプリ層の純粋関数に委ねる（ADR-20260707-b36）。
    const derived: DerivedSearchConditions = {
      state: criteria.state,
      applicantName: criteria.applicantName,
      awaitingRoleId: criteria.awaitingRoleId,
      appliedFrom: criteria.appliedFrom,
      appliedTo: criteria.appliedTo,
    };
    return selectApplicationRows(rows, derived, options?.limit).map(
      PrismaEstimateApplicationSearchQueryService.toSummaryDTO
    );
  }

  /**
   * 検索条件から不変事実だけを Prisma の where 句に組み立てる（ADR-20260707-b36）。
   * 導出条件（状態・申請者・承認待ち役割・申請日時）はここに現れず、還元後にアプリ層で絞る。
   */
  private static buildWhereClause(
    criteria: EstimateApplicationSearchCriteria
  ): Prisma.EstimateVariationWhereInput {
    const where: Prisma.EstimateVariationWhereInput = {
      // 対象は「申請 or 免除の記録を持つ」バリエーション（＝バリエーション申請状態 NONE 以外）。
      OR: [{ applications: { some: {} } }, { exemption: { isNot: null } }],
    };

    // 既定は有効（ACTIVE）のみ。includeInactive で無効も対象化する。
    if (!criteria.includeInactive) {
      where.status = "ACTIVE";
    }

    // 見積番号・得意先名・納品先名の部分一致（不変事実・ADR-0013 のリレーション越し）。
    const estimate: Prisma.EstimateWhereInput = {};
    if (criteria.estimateNumber) {
      estimate.estimateNumber = { contains: criteria.estimateNumber, mode: "insensitive" };
    }
    if (criteria.customerName) {
      estimate.customer = { name: { contains: criteria.customerName, mode: "insensitive" } };
    }
    if (criteria.deliveryLocationName) {
      estimate.deliveryLocation = {
        name: { contains: criteria.deliveryLocationName, mode: "insensitive" },
      };
    }
    if (Object.keys(estimate).length > 0) {
      where.estimate = estimate;
    }

    return where;
  }

  /**
   * バリエーション1行を還元済み行に畳む。状態は書き込みと同一のドメイン純粋関数で導出し、
   * 申請者・申請日時・承認待ち役割は「最新申請」を出自とする（免除行は免除者・免除日時・null）。
   */
  private static reduceRow(variation: VariationSearchRow): ReducedApplicationRow {
    const isExempted = variation.exemption !== null;
    const state = VariationApplicationState.reduce({
      isExempted,
      applications: variation.applications.map((application) => ({
        attempt: application.attempt,
        status: PrismaEstimateApplicationSearchQueryService.deriveStatus(application),
      })),
    });

    const provenance = PrismaEstimateApplicationSearchQueryService.deriveProvenance(
      variation,
      state
    );

    return {
      variationId: variation.id,
      estimateNumber: variation.estimate.estimateNumber,
      variationNumber: variation.variationNumber,
      customerName: variation.estimate.customer.name,
      deliveryLocationName: variation.estimate.deliveryLocation.name,
      submissionType: variation.submissionType,
      finalTotal: Number(variation.finalTotal),
      state,
      ...provenance,
    };
  }

  /** 申請1件の §3.6 導出状態を、終端イベント行の存在から materialize して算出する（集約 getter と一致）。 */
  private static deriveStatus(application: ApplicationRow) {
    return deriveApplicationStatus({
      hasWithdrawal: application.withdrawal !== null,
      hasAnyRejection: application.steps.some((step) => step.rejection !== null),
      allStepsApproved: application.steps.every((step) => step.approval !== null),
    });
  }

  /**
   * 行の申請者・申請日時・承認待ち役割の出自を決める。
   * EXEMPTED は免除者・免除日時・承認待ち無し、それ以外は最新申請（attempt 最大）を出自とし、
   * PENDING のときのみ承認待ち役割（承認行の無い最小 stepOrder の役割）を解決する。
   */
  private static deriveProvenance(
    variation: VariationSearchRow,
    state: VariationApplicationState
  ): Pick<
    ReducedApplicationRow,
    "applicantName" | "appliedAt" | "awaitingRoleId" | "awaitingRoleName"
  > {
    if (state === VariationApplicationState.EXEMPTED && variation.exemption !== null) {
      return {
        applicantName: variation.exemption.exemptedBy.name,
        appliedAt: variation.exemption.createdAt,
        awaitingRoleId: null,
        awaitingRoleName: null,
      };
    }

    const latest = variation.applications.reduce<ApplicationRow | null>(
      (max, application) => (max === null || application.attempt > max.attempt ? application : max),
      null
    );
    if (latest === null) {
      // where で申請 or 免除の存在を保証しているため通常到達しない（型の穴埋めの防御）。
      throw new Error(`バリエーション ${variation.id} に申請も免除もありません`);
    }

    const awaiting = PrismaEstimateApplicationSearchQueryService.deriveAwaitingRole(latest, state);
    return {
      applicantName: latest.applicant.name,
      appliedAt: latest.createdAt,
      ...awaiting,
    };
  }

  /**
   * 最新申請の承認待ち役割を解決する。PENDING 以外は承認待ちが無いため null。
   * PENDING のときは承認行の無い最小 stepOrder（{@link deriveAwaitingStepOrder}）の役割を引く。
   */
  private static deriveAwaitingRole(
    latest: ApplicationRow,
    state: VariationApplicationState
  ): Pick<ReducedApplicationRow, "awaitingRoleId" | "awaitingRoleName"> {
    if (state !== VariationApplicationState.PENDING) {
      return { awaitingRoleId: null, awaitingRoleName: null };
    }
    const awaitingStepOrder = deriveAwaitingStepOrder(
      latest.steps.map((step) => ({
        stepOrder: step.stepOrder,
        hasApproval: step.approval !== null,
      }))
    );
    const awaitingStep = latest.steps.find((step) => step.stepOrder === awaitingStepOrder);
    if (awaitingStep === undefined) {
      return { awaitingRoleId: null, awaitingRoleName: null };
    }
    return { awaitingRoleId: awaitingStep.roleId, awaitingRoleName: awaitingStep.role.name };
  }

  /** 還元済み行を表示 DTO に整形する（state VO → code+label は VO 単一ソース・ADR-0069）。 */
  private static toSummaryDTO(row: ReducedApplicationRow): EstimateApplicationSummaryDTO {
    return {
      variationId: row.variationId,
      estimateNumber: row.estimateNumber,
      variationNumber: row.variationNumber,
      customerName: row.customerName,
      deliveryLocationName: row.deliveryLocationName,
      submissionType: row.submissionType,
      finalTotal: row.finalTotal,
      applicationState: { code: row.state.code, label: row.state.label },
      awaitingRoleName: row.awaitingRoleName,
      applicantName: row.applicantName,
      appliedAt: row.appliedAt,
    };
  }
}
