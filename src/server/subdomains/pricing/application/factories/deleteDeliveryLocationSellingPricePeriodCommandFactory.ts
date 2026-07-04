import { DeleteDeliveryLocationSellingPricePeriodCommand } from "../commands/DeleteDeliveryLocationSellingPricePeriodCommand";
import { PrismaDeliveryLocationSellingPriceRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";

/** 納品先別売単価の未来開始行を削除するコマンド（#545）を Repository から構築する。 */
export function deleteDeliveryLocationSellingPricePeriodCommandFactory(): DeleteDeliveryLocationSellingPricePeriodCommand {
  return new DeleteDeliveryLocationSellingPricePeriodCommand(
    new PrismaDeliveryLocationSellingPriceRepository()
  );
}
