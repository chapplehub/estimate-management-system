import { DeleteCommonSellingPricePeriodCommand } from "../commands/DeleteCommonSellingPricePeriodCommand";
import { PrismaCommonSellingPriceRepository } from "../../infrastructure/prisma/PrismaCommonSellingPriceRepository";

/** 共通売単価の未来開始行を削除するコマンド（#429・#473）を Repository から構築する。 */
export function deleteCommonSellingPricePeriodCommandFactory(): DeleteCommonSellingPricePeriodCommand {
  return new DeleteCommonSellingPricePeriodCommand(new PrismaCommonSellingPriceRepository());
}
