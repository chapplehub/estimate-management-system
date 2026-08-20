import { ReviseCustomerSellingPricePeriodCommand } from "../commands/ReviseCustomerSellingPricePeriodCommand";
import { PrismaCustomerSellingPriceRepository } from "../../infrastructure/prisma/PrismaCustomerSellingPriceRepository";

/** 得意先別売単価を改定日から新単価へ切り替えるコマンド（#505）を Repository から構築する。 */
export function reviseCustomerSellingPricePeriodCommandFactory(): ReviseCustomerSellingPricePeriodCommand {
  return new ReviseCustomerSellingPricePeriodCommand(new PrismaCustomerSellingPriceRepository());
}
