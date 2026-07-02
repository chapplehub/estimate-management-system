import { RegisterCostPricePeriodCommand } from "../commands/RegisterCostPricePeriodCommand";
import { PrismaCostPriceRepository } from "../../infrastructure/prisma/PrismaCostPriceRepository";

/** 原価の適用期間行を登録するコマンド（#502）を Repository から構築する。 */
export function registerCostPricePeriodCommandFactory(): RegisterCostPricePeriodCommand {
  return new RegisterCostPricePeriodCommand(new PrismaCostPriceRepository());
}
