import { DeleteCustomerSellingPricePeriodCommand } from "../commands/DeleteCustomerSellingPricePeriodCommand";
import { PrismaCustomerSellingPriceRepository } from "../../infrastructure/prisma/PrismaCustomerSellingPriceRepository";

/** 得意先別売単価の未来開始行を削除するコマンド（#505）を Repository から構築する。 */
export function deleteCustomerSellingPricePeriodCommandFactory(): DeleteCustomerSellingPricePeriodCommand {
  return new DeleteCustomerSellingPricePeriodCommand(new PrismaCustomerSellingPriceRepository());
}
