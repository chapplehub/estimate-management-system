import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";

import { EstimateApplication } from "@subdomains/estimate/domain/entities";
// 集約境界規約の正当な例外（eslint.config.mjs の本ファイル限定 override）:
// 永続化からの集約再構築のため、子エンティティ EstimateApprovalStep の reconstruct() を直接呼ぶ。
import { EstimateApprovalStep } from "@subdomains/estimate/domain/entities/approval/EstimateApprovalStep";

import { ApplicationWithdrawal } from "@subdomains/estimate/domain/values/approval/ApplicationWithdrawal";
import { EstimateApplicationId } from "@subdomains/estimate/domain/values/approval/EstimateApplicationId";
import { EstimateApprovalStepId } from "@subdomains/estimate/domain/values/approval/EstimateApprovalStepId";
import { RejectionComment } from "@subdomains/estimate/domain/values/approval/RejectionComment";
import { StepApproval } from "@subdomains/estimate/domain/values/approval/StepApproval";
import { StepRejection } from "@subdomains/estimate/domain/values/approval/StepRejection";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";

import { Prisma } from "@generated/prisma/client";

/**
 * findById / findByStepId / findByVariationId で申請集約を再構築するための include 定義。
 * ステップは stepOrder 昇順で固定し、各ステップの終端イベント（承認/差戻）と申請レベルの
 * 取下イベントを併せて読む。状態（§3.6）はこれらの行の存在から導出する（ADR-0058）。
 */
export const ESTIMATE_APPLICATION_FULL_INCLUDE = {
  steps: {
    orderBy: { stepOrder: "asc" },
    include: { approval: true, rejection: true },
  },
  withdrawal: true,
} satisfies Prisma.EstimateApplicationInclude;

export type PrismaEstimateApplicationFull = Prisma.EstimateApplicationGetPayload<{
  include: typeof ESTIMATE_APPLICATION_FULL_INCLUDE;
}>;

type PrismaStepFull = PrismaEstimateApplicationFull["steps"][number];

/**
 * EstimateApplicationMapper
 *
 * 見積申請集約（EstimateApplication → EstimateApprovalStep ＋ 終端イベント VO）と Prisma
 * レコードを相互変換する。集約境界規約の正当な例外として、子エンティティ EstimateApprovalStep の
 * reconstruct() を直接呼ぶ（eslint override は本ファイルに限定）。
 *
 * 終端イベント VO（StepApproval / StepRejection / ApplicationWithdrawal）は独自 identity を
 * 持たないイベント payload のため、occurredAt にはイベント行の createdAt を充てる（ADR-0058）。
 */
export class EstimateApplicationMapper {
  // ========================================
  // toDomain（読み取り）
  // ========================================

  static toDomain(row: PrismaEstimateApplicationFull): EstimateApplication {
    return EstimateApplication.reconstruct({
      id: new EstimateApplicationId(row.id),
      variationId: new EstimateVariationId(row.variationId),
      attempt: row.attempt,
      applicantEmployeeId: new EmployeeId(row.applicantEmployeeId),
      finalApprovalPositionId: new PositionId(row.finalApprovalPositionId),
      steps: row.steps.map((s) => EstimateApplicationMapper.stepToDomain(s)),
      withdrawal: row.withdrawal
        ? ApplicationWithdrawal.create(
            new EmployeeId(row.withdrawal.withdrawnByEmployeeId),
            row.withdrawal.createdAt
          )
        : null,
    });
  }

  private static stepToDomain(s: PrismaStepFull): EstimateApprovalStep {
    return EstimateApprovalStep.reconstruct({
      id: new EstimateApprovalStepId(s.id),
      stepOrder: s.stepOrder,
      roleId: new RoleId(s.roleId),
      approval: s.approval
        ? StepApproval.create(new EmployeeId(s.approval.approverEmployeeId), s.approval.createdAt)
        : null,
      rejection: s.rejection
        ? StepRejection.create(
            new EmployeeId(s.rejection.rejectedByEmployeeId),
            new RejectionComment(s.rejection.comment),
            s.rejection.createdAt
          )
        : null,
    });
  }

  // ========================================
  // create パス（ルート＋ステップ骨格のネスト create。生成時点でイベントは無い）
  // ========================================

  /**
   * 新規申請の create-input へ変換する。ステップは骨格（役割・順序）のみをネスト create し、
   * 終端イベントは持たない（生成時点で決定は無く、状態は行の存在から導出する・ADR-0058）。
   * version（@default(1)）・createdAt（@default(now())）は DB 既定に委ねるため含めない。
   */
  static toCreateInput(
    application: EstimateApplication
  ): Prisma.EstimateApplicationUncheckedCreateInput {
    return {
      id: application.id.value,
      variationId: application.variationId.value,
      attempt: application.attempt,
      applicantEmployeeId: application.applicantEmployeeId.value,
      finalApprovalPositionId: application.finalApprovalPositionId.value,
      steps: {
        create: application.steps.map((step) => ({
          id: step.id.value,
          stepOrder: step.stepOrder,
          roleId: step.roleId.value,
        })),
      },
    };
  }

  // ========================================
  // update パス（終端イベントの自然キー create-input。upsert の create 側に渡す）
  // 各イベント行は stepId / applicationId を @id 自然キーに持つため idempotent upsert が安全。
  // occurredAt は DB の created_at（@default(now())）に委ねるため含めない（ADR-0058）。
  // ========================================

  /** 承認イベントの create-input 群（承認済ステップのみ）。 */
  static toStepApprovalCreateInputs(
    application: EstimateApplication
  ): Prisma.EstimateStepApprovalUncheckedCreateInput[] {
    return application.steps.flatMap((step) => {
      const approval = step.approval;
      return approval
        ? [{ stepId: step.id.value, approverEmployeeId: approval.approverEmployeeId.value }]
        : [];
    });
  }

  /** 差戻イベントの create-input 群（差戻済ステップのみ）。 */
  static toStepRejectionCreateInputs(
    application: EstimateApplication
  ): Prisma.EstimateStepRejectionUncheckedCreateInput[] {
    return application.steps.flatMap((step) => {
      const rejection = step.rejection;
      return rejection
        ? [
            {
              stepId: step.id.value,
              rejectedByEmployeeId: rejection.rejectedByEmployeeId.value,
              comment: rejection.comment.value,
            },
          ]
        : [];
    });
  }

  /** 取下イベントの create-input（未取下なら null）。 */
  static toWithdrawalCreateInput(
    application: EstimateApplication
  ): Prisma.EstimateApplicationWithdrawalUncheckedCreateInput | null {
    const withdrawal = application.withdrawal;
    if (!withdrawal) {
      return null;
    }
    return {
      applicationId: application.id.value,
      withdrawnByEmployeeId: withdrawal.withdrawnByEmployeeId.value,
    };
  }
}
