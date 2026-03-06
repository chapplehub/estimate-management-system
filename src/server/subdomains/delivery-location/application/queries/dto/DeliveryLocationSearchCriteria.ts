import type { SortOrder } from "@server/shared/queries/SortOrder";

/**
 * 納品先検索条件
 */
export type DeliveryLocationSearchCriteria = {
  /** 名前での部分一致検索 */
  name?: string;
  /** コードでの完全一致検索 */
  code?: string;
  /** 得意先IDでのフィルタ */
  customerId?: string;
  /** 有効/無効フィルタ */
  isActive?: boolean;
};

/**
 * リスト取得のオプション
 */
export type DeliveryLocationSortField = "name" | "code" | "createdAt" | "updatedAt";

/**
 * リスト取得のオプション
 */
export type DeliveryLocationListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: SortOrder<DeliveryLocationSortField>;
};
