import { Position } from "../entities/Position";
import { PositionCd } from "../values/PositionCd";

/**
 * 役職リポジトリインターフェース
 *
 * 役職は固定4種のマスタデータのため、読み取り専用。
 * 書き込み操作（save, delete）は提供しない。
 */
export interface PositionRepository {
  /**
   * IDで役職を取得
   */
  findById(id: string): Promise<Position | null>;

  /**
   * 役職コードで役職を取得
   */
  findByPositionCd(positionCd: PositionCd): Promise<Position | null>;

  /**
   * 全役職を取得
   */
  findAll(): Promise<Position[]>;
}
