import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
import { DeliveryLocationSellingPriceRepository } from "@subdomains/pricing/domain/repositories/DeliveryLocationSellingPriceRepository";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

/**
 * 納品先ID×商品IDから納品先別売単価集約を取得し、無ければ {@link NotFoundEntityError} を投げる。
 *
 * 既存集約の存在を前提とする編集系コマンド（編集・適用終了・削除）が共有する定型。「無ければ NotFound」
 * はアプリ層のユースケース上の関心であり、Repository は null を返す問い合わせに徹する（既存規約）。
 * 登録コマンドは null を正常系（新規 insert）に分岐するため、このヘルパは使わない。
 */
export async function loadDeliveryLocationSellingPriceOrThrow(
  repository: DeliveryLocationSellingPriceRepository,
  deliveryLocationId: string,
  productId: string
): Promise<DeliveryLocationSellingPrice> {
  const aggregate = await repository.findByDeliveryLocationIdAndProductId(
    new DeliveryLocationId(deliveryLocationId),
    new ProductId(productId)
  );
  if (aggregate === null) {
    throw new NotFoundEntityError(DeliveryLocationSellingPrice, { deliveryLocationId, productId });
  }
  return aggregate;
}
