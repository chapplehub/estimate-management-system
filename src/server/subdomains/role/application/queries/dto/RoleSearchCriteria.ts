import type { SortOrder } from "@server/shared/queries/SortOrder";

/**
 * 役割検索条件
 */
export type RoleSearchCriteria = {
  /** 役割名での部分一致検索 */
  name?: string;

  /** 役割コードでの完全一致検索 */
  roleCd?: string;

  /** 役職IDでのフィルタ */
  positionId?: string;

  /** 上位役割IDでのフィルタ（nullでルート役割のみ） */
  superiorRoleId?: string | null;
};

/**
 * ソート可能なフィールド
 */
export type RoleSortField = "name" | "roleCd" | "createdAt" | "updatedAt";

/**
 * リスト取得のオプション
 */
export type RoleListOptions = {
  /** 取得件数制限 */
  limit?: number;

  /** オフセット */
  offset?: number;

  /** ソート順 */
  orderBy?: SortOrder<RoleSortField>;
};
