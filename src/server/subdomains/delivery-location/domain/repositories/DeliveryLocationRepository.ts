import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";

/**
 * 納品先リポジトリインターフェース
 *
 * 検索・一覧取得については DeliveryLocationQueryService を使用すること
 */
export interface DeliveryLocationRepository {
  /**
   * 納品先を保存（新規作成・更新）
   */
  save(deliveryLocation: DeliveryLocation): Promise<DeliveryLocation>;

  /**
   * 納品先を削除
   */
  delete(id: DeliveryLocationId): Promise<void>;

  /**
   * IDで納品先を取得
   */
  findById(id: DeliveryLocationId): Promise<DeliveryLocation | null>;

  /**
   * 取引先コードで納品先を取得（重複チェック等で使用）
   */
  findByCode(code: CompanyCode): Promise<DeliveryLocation | null>;
}
