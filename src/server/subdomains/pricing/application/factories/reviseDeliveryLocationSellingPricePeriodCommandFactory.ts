import { ReviseDeliveryLocationSellingPricePeriodCommand } from "../commands/ReviseDeliveryLocationSellingPricePeriodCommand";
import { PrismaDeliveryLocationSellingPriceRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";

/** 納品先別売単価を改定日から新単価へ切り替えるコマンド（#545）を Repository から構築する。 */
export function reviseDeliveryLocationSellingPricePeriodCommandFactory(): ReviseDeliveryLocationSellingPricePeriodCommand {
  return new ReviseDeliveryLocationSellingPricePeriodCommand(
    new PrismaDeliveryLocationSellingPriceRepository()
  );
}
