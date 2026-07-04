import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { RegisterDeliveryLocationSellingPricePeriodCommand } from "../commands/RegisterDeliveryLocationSellingPricePeriodCommand";
import { PrismaDeliveryLocationSellingPriceRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";

/**
 * 納品先別売単価の適用期間行を登録するコマンド（#545）を Repository から構築する。
 * セット商品拒否のガード（#531）のため商品区分を引く ProductQueryService も注入する。
 */
export function registerDeliveryLocationSellingPricePeriodCommandFactory(): RegisterDeliveryLocationSellingPricePeriodCommand {
  return new RegisterDeliveryLocationSellingPricePeriodCommand(
    new PrismaDeliveryLocationSellingPriceRepository(),
    new PrismaProductQueryService()
  );
}
