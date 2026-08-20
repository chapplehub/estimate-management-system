import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";
import {
  type ApplicationOperationFacts,
  type EstimateApplicationDetailProjection,
  type EstimateApplicationDetailQueryService,
} from "@subdomains/estimate/application/queries/EstimateApplicationDetailQueryService";
import {
  type ApplicationDetailSummaryView,
  type ApplicationView,
  type ApprovalStepView,
  type ExemptionView,
} from "@subdomains/estimate/application/queries/dto/EstimateApplicationDetailDTO";
import {
  ApplicationStatus,
  type ApplicationStatusCode,
} from "@subdomains/estimate/domain/values/approval/ApplicationStatus";
import { type ApprovalStepStatusCode } from "@subdomains/estimate/domain/values/approval/ApprovalStepStatus";
import { deriveApplicationStatus } from "@subdomains/estimate/domain/values/approval/deriveApplicationStatus";
import { deriveApprovalStepStatus } from "@subdomains/estimate/domain/values/approval/deriveApprovalStepStatus";
import { deriveAwaitingStepOrder } from "@subdomains/estimate/domain/values/approval/deriveAwaitingStepOrder";
import {
  EstimateExemptionReason,
  type EstimateExemptionReasonCode,
} from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { VariationApplicationState } from "@subdomains/estimate/domain/values/approval/VariationApplicationState";

/**
 * 見積申請詳細の読み取り select 定義。対象バリエーション 1 件について、不変事実（見積番号・得意先名・
 * 納品先名・提出区分・税込金額）と、状態導出＋表示に必要な最小射影（免除の理由・免除者・免除日時、
 * 各申請の attempt・version・申請者・申請日時・最終承認役職、取下の取下者・日時、各ステップの順序・
 * 役割・承認/差戻イベントの実行者・日時・差戻コメント）を引く。状態は保存しないため（ADR-0058）、
 * 終端イベント行の存在有無から書き込みと共有の純粋関数で還元する。
 */
const VARIATION_DETAIL_SELECT = {
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
  // 免除は理由＋出自（免除者名・免除日時）を引く（1バリエーション高々1件・ADR-0054）。
  exemption: {
    select: {
      reason: true,
      createdAt: true,
      exemptedBy: { select: { name: true } },
    },
  },
  applications: {
    select: {
      id: true,
      attempt: true,
      version: true,
      createdAt: true,
      applicantEmployeeId: true,
      applicant: { select: { name: true } },
      finalApprovalPosition: { select: { name: true } },
      // 取下イベント（申請レベル・高々1）の存在＋出自。
      withdrawal: {
        select: { createdAt: true, withdrawnBy: { select: { name: true } } },
      },
      steps: {
        select: {
          id: true,
          stepOrder: true,
          roleId: true,
          role: { select: { name: true } },
          approval: {
            select: { createdAt: true, approver: { select: { name: true } } },
          },
          rejection: {
            select: { createdAt: true, comment: true, rejectedBy: { select: { name: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.EstimateVariationSelect;

type VariationDetailRow = Prisma.EstimateVariationGetPayload<{
  select: typeof VARIATION_DETAIL_SELECT;
}>;
type ApplicationRow = VariationDetailRow["applications"][number];
type StepRow = ApplicationRow["steps"][number];

/** 免除・非 PENDING で操作可否合成の材料が無いときの operationFacts（全 null/false）。 */
const NO_OPERATION_FACTS: ApplicationOperationFacts = {
  isPending: false,
  applicantEmployeeId: null,
  awaitingRoleId: null,
  latestApplicationId: null,
  awaitingStepId: null,
  expectedVersion: null,
};

/**
 * EstimateApplicationDetailQueryService の Prisma 実装（CQRS read model・#573・ADR-20260707-ae2）。
 *
 * 集約を再構築せず Prisma を直読みし、あるバリエーションの申請の全容を projection に還元する。操作者は
 * 知らない（操作可否の合成は app 層 Query が operator を受けて行う）。状態は保存しないため、終端イベント
 * 行の存在から**書き込みと共有のドメイン純粋関数**で還元する:
 * - 各申請の状態は {@link deriveApplicationStatus}（§3.6）、
 * - 各ステップの状態は {@link deriveApprovalStepStatus}（§3.6）、
 * - バリエーション単位は {@link VariationApplicationState.reduce}（免除最優先→最新attempt→未申請）、
 * - 承認待ちステップは {@link deriveAwaitingStepOrder}（PENDING 前提で承認行の無い最小 stepOrder）。
 *
 * 対象が見つからない／申請も免除も無いバリエーションは `null`（NotFound・一覧の母集合と整合）。
 */
export class PrismaEstimateApplicationDetailQueryService implements EstimateApplicationDetailQueryService {
  async findDetail(
    estimateNumber: string,
    variationNumber: number
  ): Promise<EstimateApplicationDetailProjection | null> {
    const variation = await prisma.estimateVariation.findFirst({
      where: { variationNumber, estimate: { estimateNumber } },
      select: VARIATION_DETAIL_SELECT,
    });

    // 見積番号なし／バリエーション番号なし → NotFound。
    if (variation === null) {
      return null;
    }

    const isExempted = variation.exemption !== null;
    // 申請も免除も無い → NotFound（一覧の母集合＝バリエーション申請状態 NONE 以外と整合）。
    if (!isExempted && variation.applications.length === 0) {
      return null;
    }

    const summary = PrismaEstimateApplicationDetailQueryService.buildSummary(variation, isExempted);

    // 免除枝（最優先・reduce の EXEMPTED と整合）。
    if (isExempted && variation.exemption !== null) {
      return {
        kind: "EXEMPTED",
        summary,
        exemption: PrismaEstimateApplicationDetailQueryService.buildExemptionView(
          variation.exemption
        ),
        operationFacts: NO_OPERATION_FACTS,
      };
    }

    // 申請枝。attempt 降順に並べ、先頭を latest・残りを past とする。
    const sorted = [...variation.applications].sort((a, b) => b.attempt - a.attempt);
    const views = sorted.map(PrismaEstimateApplicationDetailQueryService.buildApplicationView);
    const latest = views[0];
    const past = views.slice(1);

    const operationFacts = PrismaEstimateApplicationDetailQueryService.buildOperationFacts(
      sorted[0]
    );

    return { kind: "APPLICATIONS", summary, latest, past, operationFacts };
  }

  /** バリエーション要約を組み立てる。状態は書き込みと同一のドメイン純粋関数で還元する。 */
  private static buildSummary(
    variation: VariationDetailRow,
    isExempted: boolean
  ): ApplicationDetailSummaryView {
    const state = VariationApplicationState.reduce({
      isExempted,
      applications: variation.applications.map((application) => ({
        attempt: application.attempt,
        status: PrismaEstimateApplicationDetailQueryService.deriveStatus(application),
      })),
    });
    return {
      estimateNumber: variation.estimate.estimateNumber,
      variationNumber: variation.variationNumber,
      customerName: variation.estimate.customer.name,
      deliveryLocationName: variation.estimate.deliveryLocation.name,
      submissionType: variation.submissionType,
      finalTotal: Number(variation.finalTotal),
      applicationState: { code: state.code, label: state.label },
    };
  }

  /** 免除記録を表示ビューに整形する（reason の code+label は VO 単一ソース・ADR-0069）。 */
  private static buildExemptionView(
    exemption: NonNullable<VariationDetailRow["exemption"]>
  ): ExemptionView {
    const reason = EstimateExemptionReason.from(exemption.reason);
    return {
      reason: { code: reason.value as EstimateExemptionReasonCode, label: reason.label },
      exemptedByName: exemption.exemptedBy.name,
      exemptedAt: exemption.createdAt,
    };
  }

  /** 申請1件を表示ビューに整形する（状態・ステップ・取下を還元）。 */
  private static buildApplicationView(application: ApplicationRow): ApplicationView {
    const status = PrismaEstimateApplicationDetailQueryService.deriveStatus(application);
    const steps = [...application.steps]
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) =>
        PrismaEstimateApplicationDetailQueryService.buildStepView(step, application.steps, status)
      );
    return {
      applicationId: application.id,
      attempt: application.attempt,
      applicantName: application.applicant.name,
      appliedAt: application.createdAt,
      finalApprovalPositionName: application.finalApprovalPosition.name,
      status: { code: status.value as ApplicationStatusCode, label: status.label },
      steps,
      withdrawal:
        application.withdrawal !== null
          ? {
              withdrawnByName: application.withdrawal.withdrawnBy.name,
              withdrawnAt: application.withdrawal.createdAt,
            }
          : null,
    };
  }

  /**
   * ステップ1件を表示ビューに整形する。状態は §3.6 の共有純粋関数で還元し、承認者/差戻者を
   * `actorName` に畳み込む（APPROVED は承認者・REJECTED は差戻者・未決は null）。
   */
  private static buildStepView(
    step: StepRow,
    allSteps: ReadonlyArray<StepRow>,
    applicationStatus: ApplicationStatus
  ): ApprovalStepView {
    const stepStatus = deriveApprovalStepStatus({
      hasRejection: step.rejection !== null,
      hasApproval: step.approval !== null,
      applicationIsPending: applicationStatus.isPending(),
      lowerStepsAllApproved: allSteps
        .filter((other) => other.stepOrder < step.stepOrder)
        .every((other) => other.approval !== null),
    });

    let actorName: string | null = null;
    let decidedAt: Date | null = null;
    let rejectionComment: string | null = null;
    if (step.approval !== null) {
      actorName = step.approval.approver.name;
      decidedAt = step.approval.createdAt;
    } else if (step.rejection !== null) {
      actorName = step.rejection.rejectedBy.name;
      decidedAt = step.rejection.createdAt;
      rejectionComment = step.rejection.comment;
    }

    return {
      order: step.stepOrder,
      roleName: step.role.name,
      status: { code: stepStatus.value as ApprovalStepStatusCode, label: stepStatus.label },
      actorName,
      decidedAt,
      rejectionComment,
    };
  }

  /**
   * 最新申請から操作可否合成の生事実を還元する（操作者非依存）。PENDING のときのみ承認待ちステップ
   * （承認行の無い最小 stepOrder）の役割 ID・ステップ ID を解決する。非 PENDING は宛先系を null に落とす。
   */
  private static buildOperationFacts(latest: ApplicationRow): ApplicationOperationFacts {
    const status = PrismaEstimateApplicationDetailQueryService.deriveStatus(latest);
    if (!status.isPending()) {
      return NO_OPERATION_FACTS;
    }

    const awaitingStepOrder = deriveAwaitingStepOrder(
      latest.steps.map((step) => ({
        stepOrder: step.stepOrder,
        hasApproval: step.approval !== null,
      }))
    );
    const awaitingStep = latest.steps.find((step) => step.stepOrder === awaitingStepOrder) ?? null;

    return {
      isPending: true,
      applicantEmployeeId: latest.applicantEmployeeId,
      awaitingRoleId: awaitingStep?.roleId ?? null,
      latestApplicationId: latest.id,
      awaitingStepId: awaitingStep?.id ?? null,
      expectedVersion: latest.version,
    };
  }

  /** 申請1件の §3.6 導出状態を、終端イベント行の存在から materialize して算出する（集約 getter と一致）。 */
  private static deriveStatus(application: ApplicationRow): ApplicationStatus {
    return deriveApplicationStatus({
      hasWithdrawal: application.withdrawal !== null,
      hasAnyRejection: application.steps.some((step) => step.rejection !== null),
      allStepsApproved: application.steps.every((step) => step.approval !== null),
    });
  }
}
