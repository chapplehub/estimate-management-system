import type { UserRole } from "@server/shared/auth/types";

/**
 * 従業員データ転送オブジェクト
 * 読み取り専用のデータ表現（軽量）
 *
 * Note: roleはUser.roleから取得される（Employee自体はroleを持たない）
 */
export type EmployeeDTO = {
  id: string;
  employeeCd: string;
  email: string;
  name: string;
  /** 所属部署ID */
  departmentId: string;
  /** 所属部署名（Department.nameから取得） */
  departmentName: string;
  /** ユーザーロール（User.roleから取得、Userが存在しない場合はnull） */
  role: UserRole | null;
  /**
   * 担当役割ID（EmployeeRole から導出、役割なし＝課員は null）。
   * 編集画面の現在値復元（セレクトの preselect）に用いる。
   */
  assignedRoleId: string | null;
  /**
   * 担当役割名（EmployeeRole → Role.name から解決、役割なし＝課員は null）。
   * 一覧の担当役割列の表示に用いる（ADR-0013）。
   */
  assignedRoleName: string | null;
  /**
   * 明示上位役割ID（EmployeeSuperiorRole から導出）。課員（担当役割なし）のみ値を持ち、
   * 役割持ちは常に null（I1 により明示行を持たない）。登録・更新画面の現在値復元に用いる。
   * 承認起点の導出（findSuperiorRoleId）とは別読み。
   */
  explicitSuperiorRoleId: string | null;
  /**
   * 従業員の上位役割名（承認起点の役割名）。findSuperiorRoleId と同じ導出分岐を名前解決したもの。
   * 担当役割あり→その役割の上位役割名／課員→明示上位役割名／どちらも無→null。
   * 一覧の上位役割列の表示に用いる（ADR-0013）。承認起点の導出（findSuperiorRoleId）とは別読み。
   */
  superiorRoleName: string | null;
  /** 楽観ロックトークン（ADR-0039）。編集画面表示時の値をフォームで往復させる */
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
