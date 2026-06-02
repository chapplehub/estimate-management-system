import prisma from "@server/prisma";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import {
  ESTIMATE_FULL_INCLUDE,
  EstimateMapper,
} from "@subdomains/estimate/infrastructure/mappers/EstimateMapper";

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
      // 更新パス（差分 upsert）は Step 3 で実装する
      throw new Error("PrismaEstimateRepository.save (update path) is not yet implemented");
    }

    const created = await prisma.estimate.create({
      data: EstimateMapper.toEstimateCreateInput(estimate),
      include: ESTIMATE_FULL_INCLUDE,
    });

    return EstimateMapper.toDomain(created);
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
