import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EstimateApprovalExemption } from "@subdomains/estimate/domain/entities";
import { EstimateApprovalExemptionId } from "@subdomains/estimate/domain/values/approval/EstimateApprovalExemptionId";
import { EstimateExemptionReason } from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { Prisma } from "@generated/prisma/client";
import type { EstimateExemptionReason as PrismaEstimateExemptionReason } from "@generated/prisma/enums";

/**
 * findByVariationId で集約を再構築するための型。承認免除は子エンティティを持たない薄い集約
 * （ADR-0054）のため include 定義は不要で、フラットなレコード型をそのまま使う。
 */
export type PrismaEstimateApprovalExemption = Prisma.EstimateApprovalExemptionGetPayload<
  Record<string, never>
>;

/**
 * EstimateApprovalExemptionMapper
 *
 * 承認免除集約（EstimateApprovalExemption）と Prisma レコードを相互変換する。集約ルートのみで
 * 子エンティティを持たないため、ルートの reconstruct() をバレル経由で呼ぶ（子の直 import は無く、
 * EstimateMapper のような eslint override は不要）。
 */
export class EstimateApprovalExemptionMapper {
  static toDomain(row: PrismaEstimateApprovalExemption): EstimateApprovalExemption {
    return EstimateApprovalExemption.reconstruct({
      id: new EstimateApprovalExemptionId(row.id),
      variationId: new EstimateVariationId(row.variationId),
      reason: EstimateExemptionReason.from(row.reason),
      exemptedByEmployeeId: new EmployeeId(row.exemptedByEmployeeId),
      createdAt: row.createdAt,
    });
  }

  /**
   * 新規作成の create-input へ変換する。免除日時（createdAt）は DB 既定（@default(now())）に
   * 委ねるため含めない（in-memory の値は捨て、refetch で確定する・§3.5）。
   */
  static toCreateInput(
    exemption: EstimateApprovalExemption
  ): Prisma.EstimateApprovalExemptionUncheckedCreateInput {
    return {
      id: exemption.id.value,
      variationId: exemption.variationId.value,
      reason: exemption.reason.value as PrismaEstimateExemptionReason,
      exemptedByEmployeeId: exemption.exemptedByEmployeeId.value,
    };
  }
}
