import { EndDateCustomerSellingPricePeriodCommand } from "../commands/EndDateCustomerSellingPricePeriodCommand";
import { PrismaCustomerSellingPriceRepository } from "../../infrastructure/prisma/PrismaCustomerSellingPriceRepository";

/** 得意先別売単価の現在有効行を適用終了するコマンド（#505）を Repository から構築する。 */
export function endDateCustomerSellingPricePeriodCommandFactory(): EndDateCustomerSellingPricePeriodCommand {
  return new EndDateCustomerSellingPricePeriodCommand(new PrismaCustomerSellingPriceRepository());
}
