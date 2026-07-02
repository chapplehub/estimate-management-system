import { DeleteCostPricePeriodCommand } from "../commands/DeleteCostPricePeriodCommand";
import { PrismaCostPriceRepository } from "../../infrastructure/prisma/PrismaCostPriceRepository";

/** 原価の未来開始行を削除するコマンド（#502）を Repository から構築する。 */
export function deleteCostPricePeriodCommandFactory(): DeleteCostPricePeriodCommand {
  return new DeleteCostPricePeriodCommand(new PrismaCostPriceRepository());
}
