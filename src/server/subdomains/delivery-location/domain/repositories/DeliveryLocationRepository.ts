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
   * 納品先を削除（楽観ロック / ADR-0039 細目3）
   *
   * @param expectedVersion 削除画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   `deleteMany({ where: { id, version } })` の count = 0（version 不一致 or 行の消失）は
   *   ConflictError を throw し、stale な画面を見て下した削除判断による誤削除を防ぐ。
   */
  delete(id: DeliveryLocationId, expectedVersion: number): Promise<void>;

  /**
   * IDで納品先を取得
   */
  findById(id: DeliveryLocationId): Promise<DeliveryLocation | null>;

  /**
   * 取引先コードで納品先を取得（重複チェック等で使用）
   */
  findByCode(code: CompanyCode): Promise<DeliveryLocation | null>;
}
