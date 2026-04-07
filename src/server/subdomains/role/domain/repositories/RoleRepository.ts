import { Role } from "../entities/Role";
import { RoleCd } from "../values/RoleCd";
import { RoleId } from "../values/RoleId";

/**
 * 役割リポジトリインターフェース
 *
 * Repository は Entity の永続化・取得（完全な Entity の再構築）を担当する。
 * 検索・一覧取得など読み取り専用の操作は RoleQueryService を使用すること。
 */
export interface RoleRepository {
  /**
   * 役割を保存（新規作成・更新）
   */
  save(role: Role): Promise<Role>;

  /**
   * 役割を削除
   */
  delete(id: RoleId): Promise<void>;

  /**
   * IDで役割を取得
   */
  findById(id: RoleId): Promise<Role | null>;

  /**
   * 役割コードで役割を取得（重複チェック等で Entity が必要な場合に使用）
   */
  findByRoleCd(roleCd: RoleCd): Promise<Role | null>;

  /**
   * 役割名で役割を取得（重複チェックで使用）
   */
  findByName(name: string): Promise<Role | null>;

  /**
   * 下位役割を取得
   * @param superiorRoleId 上位役割ID
   */
  findSubordinates(superiorRoleId: RoleId): Promise<Role[]>;

  /**
   * 役割が使用中かどうかを確認
   * EmployeeRole または Employee.superiorRoleId で参照されている場合は true
   */
  isInUse(roleId: RoleId): Promise<boolean>;
}
