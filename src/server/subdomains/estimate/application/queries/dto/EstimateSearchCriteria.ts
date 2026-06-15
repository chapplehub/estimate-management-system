import type { SortOrder } from "@server/shared/queries/SortOrder";

/**
 * 見積一覧の検索条件。本 issue ではフィルタ未実装のため空の受け皿
 * （Record<string, never>）。将来フィルタ（得意先・区分・状態など）を足すための拡張点。
 */
export type EstimateSearchCriteria = Record<string, never>;

/**
 * 一覧でソート可能なフィールド。Estimate 自身の列に限る。
 * 代表由来の金額（finalTotal）・状態（activeStatus）は別テーブル/導出のため直接ソート不可（ADR-0050）。
 */
export type EstimateSortField = "estimateNumber" | "estimateDate" | "deadline" | "createdAt";

export type EstimateListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: SortOrder<EstimateSortField>;
};
