import { ConflictError } from "@server/shared/errors/ApplicationError";
import { currentClient } from "@server/shared/infrastructure/transaction/txContext";
import { EstimateApprovalExemption } from "@subdomains/estimate/domain/entities";
import { EstimateApprovalExemptionRepository } from "@subdomains/estimate/domain/repositories/approval/EstimateApprovalExemptionRepository";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { EstimateApprovalExemptionMapper } from "@subdomains/estimate/infrastructure/mappers/approval/EstimateApprovalExemptionMapper";
import { Prisma } from "@generated/prisma/client";

/**
 * PrismaEstimateApprovalExemptionRepository
 *
 * 承認免除集約（EstimateApprovalExemption）の永続化を担う Prisma 実装（ADR-0054）。
 * 免除は生成後に状態が変わらない不変レコードのため、update / 楽観ロック / delete は提供しない。
 */
export class PrismaEstimateApprovalExemptionRepository implements EstimateApprovalExemptionRepository {
  /**
   * 承認免除を新規作成する（1バリエーション1免除・variation_id @unique）。
   * アプリ層チェックをすり抜けた二重確定レースは DB の unique 制約が最後の砦として捕捉するため、
   * P2002 を ConflictError へ翻訳して再試行可能な競合として表面化する（estimate_number 翻訳と一貫）。
   */
  async insert(exemption: EstimateApprovalExemption): Promise<EstimateApprovalExemption> {
    try {
      await currentClient().estimateApprovalExemption.create({
        data: EstimateApprovalExemptionMapper.toCreateInput(exemption),
      });
    } catch (error) {
      PrismaEstimateApprovalExemptionRepository.translateInsertConflict(error, exemption);
    }

    return this.refetch(exemption.variationId);
  }

  async findByVariationId(
    variationId: EstimateVariationId
  ): Promise<EstimateApprovalExemption | null> {
    const row = await currentClient().estimateApprovalExemption.findUnique({
      where: { variationId: variationId.value },
    });

    return row ? EstimateApprovalExemptionMapper.toDomain(row) : null;
  }

  /** 保存後の集約を読み直して返す（createdAt を DB 既定で確定させるため）。 */
  private async refetch(variationId: EstimateVariationId): Promise<EstimateApprovalExemption> {
    const found = await this.findByVariationId(variationId);
    if (!found) {
      throw new Error(`保存した承認免除の再取得に失敗しました: ${variationId.value}`);
    }
    return found;
  }

  private static translateInsertConflict(
    error: unknown,
    exemption: EstimateApprovalExemption
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(
        `バリエーション ${exemption.variationId.value} は既に承認免除されています。もう一度確認してください。`
      );
    }
    throw error;
  }
}
