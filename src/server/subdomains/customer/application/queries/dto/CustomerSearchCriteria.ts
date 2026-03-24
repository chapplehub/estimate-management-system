import type { SortOrder } from "@server/shared/queries/SortOrder";

/**
 * 得意先検索条件
 */
export type CustomerSearchCriteria = {
  /** 名前での部分一致検索 */
  name?: string;
  /** コードでの完全一致検索 */
  code?: string;
  /** 有効/無効フィルタ */
  isActive?: boolean;
  /** この日時以降に作成された得意先 */
  createdAfter?: Date;
  /** この日時以前に作成された得意先 */
  createdBefore?: Date;
};

/**
 * リスト取得のオプション
 */
export type CustomerSortField = "name" | "code" | "createdAt" | "updatedAt";

/**
 * リスト取得のオプション
 */
export type CustomerListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: SortOrder<CustomerSortField>;
};
