import type { SortOrder } from "@server/shared/queries/SortOrder";

/**
 * 商品検索条件
 */
export type ProductSearchCriteria = {
  /** コードでの部分一致検索 */
  code?: string;
  /** 名前での部分一致検索 */
  name?: string;
  /** 商品区分フィルタ */
  category?: string;
  /** 有効/無効フィルタ */
  isActive?: boolean;
};

export type ProductSortField = "code" | "name" | "createdAt" | "updatedAt";

export type ProductListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: SortOrder<ProductSortField>;
};
