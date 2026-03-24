import type { SortOrder } from "@server/shared/queries/SortOrder";

/**
 * 部署検索条件
 * 複数の条件を組み合わせて柔軟に検索できる
 */
export type DepartmentSearchCriteria = {
  /** 部署名での部分一致検索 */
  name?: string;

  /** 略称での部分一致検索 */
  abbreviation?: string;

  /** 部署コードでの完全一致検索 */
  departmentCd?: string;

  /** 有効フラグでのフィルタ */
  isActive?: boolean;

  /** 親部署IDでのフィルタ（nullでルート部署のみ） */
  parentId?: string | null;

  /** この日時以降に作成された部署 */
  createdAfter?: Date;

  /** この日時以前に作成された部署 */
  createdBefore?: Date;
};

/**
 * リスト取得のオプション
 */
export type DepartmentSortField =
  | "name"
  | "departmentCd"
  | "abbreviation"
  | "createdAt"
  | "updatedAt";

/**
 * リスト取得のオプション
 */
export type DepartmentListOptions = {
  /** 取得件数制限 */
  limit?: number;

  /** オフセット */
  offset?: number;

  /** ソート順 */
  orderBy?: SortOrder<DepartmentSortField>;
};
