import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { RegisterCommonSellingPricePeriodCommand } from "../commands/RegisterCommonSellingPricePeriodCommand";
import { PrismaCommonSellingPriceRepository } from "../../infrastructure/prisma/PrismaCommonSellingPriceRepository";

/**
 * 共通売単価の適用期間行を登録するコマンド（#429・#473）を Repository から構築する。
 * セット商品拒否のガード（#515）のため商品区分を引く ProductQueryService も注入する。
 */
export function registerCommonSellingPricePeriodCommandFactory(): RegisterCommonSellingPricePeriodCommand {
  return new RegisterCommonSellingPricePeriodCommand(
    new PrismaCommonSellingPriceRepository(),
    new PrismaProductQueryService()
  );
}
