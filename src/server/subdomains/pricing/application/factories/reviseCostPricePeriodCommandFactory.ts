import { ReviseCostPricePeriodCommand } from "../commands/ReviseCostPricePeriodCommand";
import { PrismaCostPriceRepository } from "../../infrastructure/prisma/PrismaCostPriceRepository";

/** 原価を改定日から新原価へ切り替えるコマンド（単価改定・#502）を Repository から構築する。 */
export function reviseCostPricePeriodCommandFactory(): ReviseCostPricePeriodCommand {
  return new ReviseCostPricePeriodCommand(new PrismaCostPriceRepository());
}
