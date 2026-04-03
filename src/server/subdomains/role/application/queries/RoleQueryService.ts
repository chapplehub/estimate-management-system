import { RoleDTO } from "./dto/RoleDTO";
import { RoleSearchCriteria, RoleListOptions } from "./dto/RoleSearchCriteria";

/**
 * 役割クエリサービスインターフェース
 *
 * 読み取り専用の検索・取得機能を提供
 * 軽量なDTOで結果を返す（position名, superiorRole名をJOIN）
 */
export interface RoleQueryService {
  /**
   * IDで役割を取得
   */
  findById(id: string): Promise<RoleDTO | null>;

  /**
   * 検索条件に基づいて役割を検索
   */
  search(criteria: RoleSearchCriteria, options?: RoleListOptions): Promise<RoleDTO[]>;

  /**
   * 全役割を取得
   */
  findAll(options?: RoleListOptions): Promise<RoleDTO[]>;

  /**
   * 役職IDで役割を取得
   */
  findByPositionId(positionId: string, options?: RoleListOptions): Promise<RoleDTO[]>;

  /**
   * 役割コードで役割を取得
   */
  findByRoleCd(roleCd: string): Promise<RoleDTO | null>;
}
