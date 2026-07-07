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
   * 編集画面の現在値復元に用いる。役割名はフォーム供給の一覧から解決するため持たない。
   */
  assignedRoleId: string | null;
  /**
   * 明示上位役割ID（EmployeeSuperiorRole から導出）。課員（担当役割なし）のみ値を持ち、
   * 役割持ちは常に null（I1 により明示行を持たない）。登録・更新画面の現在値復元に用いる。
   * 承認起点の導出（findSuperiorRoleId）とは別読み。
   */
  explicitSuperiorRoleId: string | null;
  /** 楽観ロックトークン（ADR-0039）。編集画面表示時の値をフォームで往復させる */
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
