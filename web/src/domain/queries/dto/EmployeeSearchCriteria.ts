import { Role } from "@/domain/types/Role";

/**
 * 従業員検索条件
 * 複数の条件を組み合わせて柔軟に検索できる
 */
export type EmployeeSearchCriteria = {
  /** 名前での部分一致検索 */
  name?: string;

  /** メールアドレスでの部分一致検索 */
  email?: string;

  /** 従業員CDでの完全一致検索 */
  employeeCd?: string;

  /** ロールでのフィルタ */
  role?: Role;

  /** アカウントロック状態でのフィルタ（true: ロック中のみ, false: ロックされていないのみ） */
  isLocked?: boolean;

  /** この日時以降に作成された従業員 */
  createdAfter?: Date;

  /** この日時以前に作成された従業員 */
  createdBefore?: Date;
};

/**
 * リスト取得のオプション
 */
export type ListOptions = {
  /** 取得件数制限 */
  limit?: number;

  /** オフセット */
  offset?: number;

  /** ソート順 */
  orderBy?: {
    field: "name" | "employeeCd" | "email" | "createdAt" | "updatedAt";
    direction: "asc" | "desc";
  };
};
