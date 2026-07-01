import { ReviseCommonSellingPricePeriodCommand } from "../commands/ReviseCommonSellingPricePeriodCommand";
import { PrismaCommonSellingPriceRepository } from "../../infrastructure/prisma/PrismaCommonSellingPriceRepository";

/** 共通売単価を改定日から新単価へ切り替えるコマンド（単価改定・#474）を Repository から構築する。 */
export function reviseCommonSellingPricePeriodCommandFactory(): ReviseCommonSellingPricePeriodCommand {
  return new ReviseCommonSellingPricePeriodCommand(new PrismaCommonSellingPriceRepository());
}
