import { PositionDTO } from "./dto/PositionDTO";

/**
 * 役職クエリサービスインターフェース
 *
 * 読み取り専用の取得機能を提供。
 * 役職は固定4種のマスタデータのため、検索機能は不要。
 */
export interface PositionQueryService {
  /**
   * IDで役職を取得
   */
  findById(id: string): Promise<PositionDTO | null>;

  /**
   * 全役職を取得
   */
  findAll(): Promise<PositionDTO[]>;
}
