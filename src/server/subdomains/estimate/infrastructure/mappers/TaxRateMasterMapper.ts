import type { TaxRate as PrismaTaxRateRow } from "@generated/prisma/client";
import { TaxRateMaster } from "@subdomains/estimate/domain/entities/TaxRateMaster";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRateMasterId } from "@subdomains/estimate/domain/values/TaxRateMasterId";

/**
 * 消費税率マスタの Prisma レコード → ドメインエンティティ変換。
 *
 * rate は Decimal で取得されるため Number 経由で TaxRate VO に変換する
 * （EstimateMapper の taxRate 復元と同型）。本イシューは読み取り専用のため
 * toDomain のみ提供する。
 */
export class TaxRateMasterMapper {
  static toDomain(row: PrismaTaxRateRow): TaxRateMaster {
    return TaxRateMaster.reconstruct(
      new TaxRateMasterId(row.id),
      new TaxRate(Number(row.rate)),
      row.effectiveFrom
    );
  }
}
