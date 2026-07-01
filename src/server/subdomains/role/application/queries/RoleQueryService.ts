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

  /**
   * 指定役割のうち承認者（メンバー＝`EmployeeRole`）が1人以上いる役割IDの集合を返す射影（#417）。
   *
   * 承認チェーン構築の「承認者不在（NO_APPROVER）」判定に使う汎用事実（メンバー有無）であり、
   * 承認固有でないため role 本拠に置く。入力に無い役割や存在しない役割は結果に含めない。
   *
   * @param roleIds 判定対象の役割ID列
   * @returns メンバーが存在する役割IDの集合（部分集合・空入力なら空集合）
   */
  findRoleIdsWithMembers(roleIds: string[]): Promise<Set<string>>;

  /**
   * 指定従業員が指定役割のメンバー（`EmployeeRole`）かを判定する（#418）。
   *
   * 承認/差戻ユースケースの個人認可（当該ステップの役割メンバーのみ操作可・システム設計書 §7.4/§12）に
   * 使う。役割グラフは estimate 集約の外にあるため、判定はアプリ層でこのクエリを介して行う
   * （ドメインにポートを持たせない・ADR-0030/0052）。存在しない役割・従業員は false。
   *
   * @param roleId 判定対象の役割ID
   * @param employeeId 判定対象の従業員ID
   * @returns メンバーであれば true
   */
  hasMember(roleId: string, employeeId: string): Promise<boolean>;
}
