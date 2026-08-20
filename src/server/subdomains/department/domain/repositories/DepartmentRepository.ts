import { Department } from "../entities/Department";
import { DepartmentCd } from "../values/DepartmentCd";
import { DepartmentId } from "../values/DepartmentId";

/**
 * 部署リポジトリインターフェース
 *
 * Repository は Entity の永続化・取得（完全な Entity の再構築）を担当する。
 * 検索・一覧取得など読み取り専用の操作は DepartmentQueryService を使用すること。
 */
export interface DepartmentRepository {
  /**
   * 部署を新規作成
   */
  insert(department: Department): Promise<Department>;

  /**
   * 既存部署を更新（楽観ロック / ADR-0039）
   *
   * @param expectedVersion 編集画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   保存時点の version と一致しない場合は ConflictError を throw し、後勝ちの変更喪失を防ぐ。
   */
  update(department: Department, expectedVersion: number): Promise<Department>;

  /**
   * 部署を削除（楽観ロック / ADR-0039 細目3）
   *
   * @param expectedVersion 削除画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   `deleteMany({ where: { id, version } })` の count = 0（version 不一致 or 行の消失）は
   *   ConflictError を throw し、stale な画面を見て下した削除判断による誤削除を防ぐ。
   */
  delete(id: DepartmentId, expectedVersion: number): Promise<void>;

  /**
   * IDで部署を取得（Entity の完全な再構築が必要な場合に使用）
   * 単なる表示目的の場合は DepartmentQueryService を使用すること
   */
  findById(id: DepartmentId): Promise<Department | null>;

  /**
   * 部署コードで部署を取得（重複チェック等で Entity が必要な場合に使用）
   */
  findByDepartmentCd(departmentCd: DepartmentCd): Promise<Department | null>;

  /**
   * 子部署を取得
   * @param parentId 親部署ID
   */
  findChildren(parentId: DepartmentId): Promise<Department[]>;

  /**
   * ルート部署（parentIdがnull）を全て取得
   */
  findRootDepartments(): Promise<Department[]>;
}
