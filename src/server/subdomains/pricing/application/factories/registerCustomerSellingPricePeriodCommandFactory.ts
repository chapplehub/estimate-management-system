import { RegisterCustomerSellingPricePeriodCommand } from "../commands/RegisterCustomerSellingPricePeriodCommand";
import { PrismaCustomerSellingPriceRepository } from "../../infrastructure/prisma/PrismaCustomerSellingPriceRepository";

/** 得意先別売単価の適用期間行を登録するコマンド（#505）を Repository から構築する。 */
export function registerCustomerSellingPricePeriodCommandFactory(): RegisterCustomerSellingPricePeriodCommand {
  return new RegisterCustomerSellingPricePeriodCommand(new PrismaCustomerSellingPriceRepository());
}
