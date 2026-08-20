import prisma from "@server/prisma";
import { TaxRateMaster } from "@subdomains/estimate/domain/entities/TaxRateMaster";
import { TaxRateRepository } from "@subdomains/estimate/domain/repositories/TaxRateRepository";
import { TaxRateMasterMapper } from "@subdomains/estimate/infrastructure/mappers/TaxRateMasterMapper";

/**
 * TaxRateRepository の Prisma 実装（設計書 §11.5 / §8.7）。
 *
 * 適用税率の解決は「effectiveFrom <= 対象日時 の中で effectiveFrom が最大の1行」。
 * 税率タイムラインの単調性（ギャップなし）を前提とし、ORDER BY effective_from DESC
 * LIMIT 1 で取得する。
 */
export class PrismaTaxRateRepository implements TaxRateRepository {
  async findEffectiveAt(date: Date): Promise<TaxRateMaster | null> {
    const row = await prisma.taxRate.findFirst({
      where: { effectiveFrom: { lte: date } },
      orderBy: { effectiveFrom: "desc" },
    });

    // 対象日時が最古行より前で該当が無い場合は null を返す（ドメイン的意味づけは呼び出し側の責務）。
    return row === null ? null : TaxRateMasterMapper.toDomain(row);
  }
}
