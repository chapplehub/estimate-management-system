import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CostPrice } from "@subdomains/pricing/domain/entities";
import { CostPriceRepository } from "@subdomains/pricing/domain/repositories/CostPriceRepository";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

/**
 * 商品IDから原価集約を取得し、無ければ {@link NotFoundEntityError} を投げる。
 *
 * 既存集約の存在を前提とする編集系コマンド（編集・適用終了・削除）が共有する定型。「無ければ NotFound」
 * はアプリ層のユースケース上の関心であり、Repository は null を返す問い合わせに徹する（既存規約）。
 * 登録コマンドは null を正常系（新規 insert）に分岐するため、このヘルパは使わない。
 */
export async function loadCostPriceOrThrow(
  repository: CostPriceRepository,
  productId: string
): Promise<CostPrice> {
  const aggregate = await repository.findByProductId(new ProductId(productId));
  if (aggregate === null) {
    throw new NotFoundEntityError(CostPrice, { productId });
  }
  return aggregate;
}
