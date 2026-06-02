import prisma from "@server/prisma";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import {
  ESTIMATE_FULL_INCLUDE,
  EstimateMapper,
} from "@subdomains/estimate/infrastructure/mappers/EstimateMapper";
import { Prisma } from "@generated/prisma/client";

/**
 * 更新時、バリエーション番号の入れ替えで `@@unique([estimateId, variationNumber])`
 * に即時衝突しないよう、既存行を一時退避する際のオフセット。
 * ドメイン上の variationNumber は 1–99 なので、この帯（1000+）とは決して衝突しない。
 */
const VARIATION_NUMBER_PARK_OFFSET = 1000;

/**
 * PrismaEstimateRepository
 *
 * 見積集約（Estimate → EstimateVariation → EstimateItem ＋ 修理系子エンティティ）の
 * 永続化を担う EstimateRepository の Prisma 実装。
 * 集約ルート Estimate 単位でのみ永続化し、子は集約経由でカスケードする。
 */
export class PrismaEstimateRepository implements EstimateRepository {
  async save(estimate: Estimate): Promise<Estimate> {
    const existing = await prisma.estimate.findUnique({
      where: { id: estimate.id.value },
      select: { id: true },
    });

    if (existing) {
      await PrismaEstimateRepository.update(estimate);
    } else {
      await prisma.estimate.create({
        data: EstimateMapper.toEstimateCreateInput(estimate),
      });
    }

    const row = await prisma.estimate.findUnique({
      where: { id: estimate.id.value },
      include: ESTIMATE_FULL_INCLUDE,
    });
    if (!row) {
      throw new Error(`保存した見積の再取得に失敗しました: ${estimate.id.value}`);
    }
    return EstimateMapper.toDomain(row);
  }

  /**
   * 既存集約の更新。子の行 identity（id・createdAt）を保持する差分 upsert。
   * 全削除→再作成にしないのは、EstimateVariation を参照する Order / Copy / Revision を
   * カスケード破壊しないため。
   */
  private static async update(estimate: Estimate): Promise<void> {
    const estimateId = estimate.id.value;
    const variationIds = estimate.variations.map((v) => v.id.value);

    try {
      await prisma.$transaction(async (tx) => {
        // 1. ルートの scalar フィールドを更新
        await tx.estimate.update({
          where: { id: estimateId },
          data: EstimateMapper.toEstimateScalarData(estimate),
        });

        // 2. 集約から消えたバリエーションを削除（items → revisedDetail へカスケード）
        await tx.estimateVariation.deleteMany({
          where: { estimateId, id: { notIn: variationIds } },
        });

        // 3. 2 フェーズ採番: 残存バリエーションを 1–99 帯の外へ一括退避し、
        //    番号入れ替え時の即時ユニーク制約衝突を回避する。
        await tx.estimateVariation.updateMany({
          where: { estimateId },
          data: { variationNumber: { increment: VARIATION_NUMBER_PARK_OFFSET } },
        });

        // 4. 各バリエーションを最終番号で upsert し、配下の明細を差分反映
        for (const variation of estimate.variations) {
          const variationId = variation.id.value;
          const variationScalar = EstimateMapper.toVariationScalarData(variation);
          await tx.estimateVariation.upsert({
            where: { id: variationId },
            create: { id: variationId, estimateId, ...variationScalar },
            update: variationScalar,
          });

          const itemIds = variation.items.map((i) => i.id.value);
          await tx.estimateItem.deleteMany({
            where: { variationId, id: { notIn: itemIds } },
          });

          for (const item of variation.items) {
            const itemId = item.id.value;
            const itemScalar = EstimateMapper.toItemScalarData(item);
            await tx.estimateItem.upsert({
              where: { id: itemId },
              create: { id: itemId, variationId, ...itemScalar },
              update: itemScalar,
            });

            // 改訂明細詳細（1:1）の同期
            if (item.revisedDetail) {
              const revisedScalar = EstimateMapper.toRevisedDetailScalarData(item.revisedDetail);
              await tx.revisedEstimateItemDetail.upsert({
                where: { estimateItemId: itemId },
                create: {
                  id: item.revisedDetail.id.value,
                  estimateItemId: itemId,
                  ...revisedScalar,
                },
                update: revisedScalar,
              });
            } else {
              await tx.revisedEstimateItemDetail.deleteMany({
                where: { estimateItemId: itemId },
              });
            }
          }
        }

        // 5. 修理系サブタイプ（排他・1:1）の同期。存在する片方を upsert、他方を削除。
        if (estimate.repairDetail) {
          const repairScalar = EstimateMapper.toRepairDetailScalarData(estimate.repairDetail);
          await tx.repairEstimateDetail.upsert({
            where: { estimateId },
            create: { id: estimate.repairDetail.id.value, estimateId, ...repairScalar },
            update: repairScalar,
          });
        } else {
          await tx.repairEstimateDetail.deleteMany({ where: { estimateId } });
        }

        if (estimate.afterRepairDetail) {
          const afterScalar = EstimateMapper.toAfterRepairDetailScalarData(
            estimate.afterRepairDetail
          );
          await tx.afterRepairEstimateDetail.upsert({
            where: { estimateId },
            create: { id: estimate.afterRepairDetail.id.value, estimateId, ...afterScalar },
            update: afterScalar,
          });
        } else {
          await tx.afterRepairEstimateDetail.deleteMany({ where: { estimateId } });
        }
      });
    } catch (error) {
      // 他テーブル（Order / Copy / Revision）から参照中のバリエーション削除は FK 違反になる
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new Error(
          "他テーブルから参照されているバリエーションは削除できません（受注・複製・改訂の参照を確認してください）"
        );
      }
      throw error;
    }
  }

  async delete(id: EstimateId): Promise<void> {
    const existing = await prisma.estimate.findUnique({
      where: { id: id.value },
      select: { id: true },
    });

    if (!existing) {
      return;
    }

    // 子エンティティ（variations → items → revisedDetail / repair・afterRepair）は
    // schema の onDelete: Cascade で連鎖削除される。
    await prisma.estimate.delete({ where: { id: id.value } });
  }

  async findById(id: EstimateId): Promise<Estimate | null> {
    const row = await prisma.estimate.findUnique({
      where: { id: id.value },
      include: ESTIMATE_FULL_INCLUDE,
    });

    return row ? EstimateMapper.toDomain(row) : null;
  }

  async findByEstimateNumber(estimateNumber: EstimateNumber): Promise<Estimate | null> {
    const row = await prisma.estimate.findUnique({
      where: { estimateNumber: estimateNumber.value },
      include: ESTIMATE_FULL_INCLUDE,
    });

    return row ? EstimateMapper.toDomain(row) : null;
  }
}
