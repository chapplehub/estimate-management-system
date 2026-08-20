import { EditCommonSellingPricePeriodCommand } from "../commands/EditCommonSellingPricePeriodCommand";
import { PrismaCommonSellingPriceRepository } from "../../infrastructure/prisma/PrismaCommonSellingPriceRepository";

/** 共通売単価の将来行を編集するコマンド（#429・#473）を Repository から構築する。 */
export function editCommonSellingPricePeriodCommandFactory(): EditCommonSellingPricePeriodCommand {
  return new EditCommonSellingPricePeriodCommand(new PrismaCommonSellingPriceRepository());
}
