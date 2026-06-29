import { RegisterCommonSellingPricePeriodCommand } from "../commands/RegisterCommonSellingPricePeriodCommand";
import { PrismaCommonSellingPriceRepository } from "../../infrastructure/prisma/PrismaCommonSellingPriceRepository";

/** 共通売単価の適用期間行を登録するコマンド（#429・#473）を Repository から構築する。 */
export function registerCommonSellingPricePeriodCommandFactory(): RegisterCommonSellingPricePeriodCommand {
  return new RegisterCommonSellingPricePeriodCommand(new PrismaCommonSellingPriceRepository());
}
