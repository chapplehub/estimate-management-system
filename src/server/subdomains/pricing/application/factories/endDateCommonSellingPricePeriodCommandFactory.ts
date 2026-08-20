import { EndDateCommonSellingPricePeriodCommand } from "../commands/EndDateCommonSellingPricePeriodCommand";
import { PrismaCommonSellingPriceRepository } from "../../infrastructure/prisma/PrismaCommonSellingPriceRepository";

/** 共通売単価の現在有効行を適用終了するコマンド（#429・#473）を Repository から構築する。 */
export function endDateCommonSellingPricePeriodCommandFactory(): EndDateCommonSellingPricePeriodCommand {
  return new EndDateCommonSellingPricePeriodCommand(new PrismaCommonSellingPriceRepository());
}
