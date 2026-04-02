/**
 * 役割ドメインが必要とする役職リポジトリインターフェース
 *
 * Roleドメインの上位役割バリデーションに必要な最小限のメソッドのみ定義。
 * Positionサブドメインの PositionRepository とは独立したインターフェース。
 */
export interface PositionRepository {
  /**
   * 指定した役職の上位役職IDを取得
   * @returns 上位役職ID（最上位の場合は null）
   */
  findSuperiorPositionId(positionId: string): Promise<string | null>;

  /**
   * 指定した役職が存在するか確認
   */
  exists(positionId: string): Promise<boolean>;
}
