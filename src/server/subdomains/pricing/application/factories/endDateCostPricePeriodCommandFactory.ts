import { EndDateCostPricePeriodCommand } from "../commands/EndDateCostPricePeriodCommand";
import { PrismaCostPriceRepository } from "../../infrastructure/prisma/PrismaCostPriceRepository";

/** 原価の現在有効行を適用終了するコマンド（#502）を Repository から構築する。 */
export function endDateCostPricePeriodCommandFactory(): EndDateCostPricePeriodCommand {
  return new EndDateCostPricePeriodCommand(new PrismaCostPriceRepository());
}
