import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { RegisterCostPricePeriodCommand } from "../commands/RegisterCostPricePeriodCommand";
import { PrismaCostPriceRepository } from "../../infrastructure/prisma/PrismaCostPriceRepository";

/**
 * 原価の適用期間行を登録するコマンド（#502）を Repository から構築する。
 * セット商品拒否のガード（#515）のため商品区分を引く ProductQueryService も注入する。
 */
export function registerCostPricePeriodCommandFactory(): RegisterCostPricePeriodCommand {
  return new RegisterCostPricePeriodCommand(
    new PrismaCostPriceRepository(),
    new PrismaProductQueryService()
  );
}
