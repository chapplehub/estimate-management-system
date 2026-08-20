import { PositionId } from "@subdomains/position/domain/values/PositionId";

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
  findSuperiorPositionId(positionId: PositionId): Promise<PositionId | null>;

  /**
   * 指定した役職が存在するか確認
   */
  exists(positionId: PositionId): Promise<boolean>;

  /**
   * 指定した役職が役職階層の葉か（下位役職を持たないか）を判定する
   *
   * 課員に明示できる上位役割を課長級に限る検証（ADR-20260707-k4e）で用いる。
   * 役職名・CD の直書きではなく「自分を上位役職に持つ行が存在しない」で判定するため、
   * 将来より下位の役職（係長など）が増えれば葉が自動的にそちらへ移る。
   * @returns 下位役職を持たなければ true（存在しない役職も葉として true を返さないよう false）
   */
  isLeafPosition(positionId: PositionId): Promise<boolean>;
}
