import { EditCustomerSellingPricePeriodCommand } from "../commands/EditCustomerSellingPricePeriodCommand";
import { PrismaCustomerSellingPriceRepository } from "../../infrastructure/prisma/PrismaCustomerSellingPriceRepository";

/** 得意先別売単価の将来行を編集するコマンド（#505）を Repository から構築する。 */
export function editCustomerSellingPricePeriodCommandFactory(): EditCustomerSellingPricePeriodCommand {
  return new EditCustomerSellingPricePeriodCommand(new PrismaCustomerSellingPriceRepository());
}
