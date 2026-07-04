import { EndDateDeliveryLocationSellingPricePeriodCommand } from "../commands/EndDateDeliveryLocationSellingPricePeriodCommand";
import { PrismaDeliveryLocationSellingPriceRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";

/** 納品先別売単価の現在有効行を適用終了するコマンド（#545）を Repository から構築する。 */
export function endDateDeliveryLocationSellingPricePeriodCommandFactory(): EndDateDeliveryLocationSellingPricePeriodCommand {
  return new EndDateDeliveryLocationSellingPricePeriodCommand(
    new PrismaDeliveryLocationSellingPriceRepository()
  );
}
