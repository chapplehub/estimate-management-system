/**
 * ページネーション結果の汎用型
 */
export type PaginatedResult<T> = {
  /** データ配列 */
  items: T[];

  /** 総件数 */
  totalCount: number;

  /** 総ページ数 */
  totalPages: number;

  /** 現在のページ番号（1始まり） */
  currentPage: number;

  /** 1ページあたりの件数 */
  pageSize: number;

  /** 次のページが存在するか */
  hasNextPage: boolean;

  /** 前のページが存在するか */
  hasPreviousPage: boolean;
};

/**
 * ページネーションオプション
 */
export type PaginationOptions = {
  /** ページ番号（1始まり） */
  page: number;

  /** 1ページあたりの件数 */
  pageSize: number;
};
