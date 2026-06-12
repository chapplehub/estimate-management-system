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
  /** 楽観ロックトークン（ADR-0039）。編集画面表示時の値をフォームで往復させる */
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
