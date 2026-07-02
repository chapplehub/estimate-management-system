import { EditCostPricePeriodCommand } from "../commands/EditCostPricePeriodCommand";
import { PrismaCostPriceRepository } from "../../infrastructure/prisma/PrismaCostPriceRepository";

/** 原価の将来行を編集するコマンド（#502）を Repository から構築する。 */
export function editCostPricePeriodCommandFactory(): EditCostPricePeriodCommand {
  return new EditCostPricePeriodCommand(new PrismaCostPriceRepository());
}
