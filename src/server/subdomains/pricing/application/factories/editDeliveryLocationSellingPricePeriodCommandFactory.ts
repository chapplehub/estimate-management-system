import { EditDeliveryLocationSellingPricePeriodCommand } from "../commands/EditDeliveryLocationSellingPricePeriodCommand";
import { PrismaDeliveryLocationSellingPriceRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";

/** 納品先別売単価の将来行を編集するコマンド（#545）を Repository から構築する。 */
export function editDeliveryLocationSellingPricePeriodCommandFactory(): EditDeliveryLocationSellingPricePeriodCommand {
  return new EditDeliveryLocationSellingPricePeriodCommand(
    new PrismaDeliveryLocationSellingPriceRepository()
  );
}
