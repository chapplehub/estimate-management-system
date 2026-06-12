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
   *
   * @deprecated insert / update へ移行中（ADR-0039）。新規コードでは使用しない。
   */
  save(deliveryLocation: DeliveryLocation): Promise<DeliveryLocation>;

  /**
   * 納品先を新規作成
   */
  insert(deliveryLocation: DeliveryLocation): Promise<DeliveryLocation>;

  /**
   * 既存納品先を更新（楽観ロック / ADR-0039）
   *
   * @param expectedVersion 編集画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   保存時点の version と一致しない場合は ConflictError を throw し、後勝ちの変更喪失を防ぐ。
   */
  update(deliveryLocation: DeliveryLocation, expectedVersion: number): Promise<DeliveryLocation>;

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
