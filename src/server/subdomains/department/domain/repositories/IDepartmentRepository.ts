import { Department } from "../entities/Department";
import { DepartmentCd } from "../values/DepartmentCd";

/**
 * 部署リポジトリインターフェース
 *
 * Repository は Entity の永続化・取得（完全な Entity の再構築）を担当する。
 * 検索・一覧取得など読み取り専用の操作は IDepartmentQueryService を使用すること。
 */
export interface IDepartmentRepository {
  /**
   * 部署を保存（新規作成・更新）
   */
  save(department: Department): Promise<Department>;

  /**
   * 部署を削除
   */
  delete(id: string): Promise<void>;

  /**
   * IDで部署を取得（Entity の完全な再構築が必要な場合に使用）
   * 単なる表示目的の場合は IDepartmentQueryService を使用すること
   */
  findById(id: string): Promise<Department | null>;

  /**
   * 部署コードで部署を取得（重複チェック等で Entity が必要な場合に使用）
   */
  findByDepartmentCd(departmentCd: DepartmentCd): Promise<Department | null>;

  /**
   * 子部署を取得
   * @param parentId 親部署ID
   */
  findChildren(parentId: string): Promise<Department[]>;

  /**
   * ルート部署（parentIdがnull）を全て取得
   */
  findRootDepartments(): Promise<Department[]>;
}
