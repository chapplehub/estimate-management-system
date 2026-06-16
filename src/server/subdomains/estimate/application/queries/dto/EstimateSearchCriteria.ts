import type { SortOrder } from "@server/shared/queries/SortOrder";

/**
 * 見積一覧の検索条件（#349）。各フィールドは undefined のとき絞り込まない（指定分のみ AND 合成）。
 *
 * 値の型は application 層の境界として素の `string` に揃える（ProductSearchCriteria・
 * EstimateSummaryDTO と同規約）。generated/prisma の enum は持ち込まず、Prisma 実装側で
 * `as Prisma.Enum...Filter` にキャストする（DDD レイヤリング）。
 */
export type EstimateSearchCriteria = {
  /** 見積番号での部分一致検索（contains・大文字小文字無視）。 */
  estimateNumber?: string;
  /** 得意先名での部分一致検索（customer.name の contains・大文字小文字無視・ADR-0013 のリレーション越し）。 */
  customerName?: string;
  /** 見積区分フィルタ（"NEW" | "REPAIR" | "AFTER_REPAIR"。Estimate 自身の列の等値）。 */
  estimateType?: string;
  /**
   * 状態フィルタ（"ACTIVE" | "INACTIVE"）。代表バリエーション由来（ADR-0051）の導出値だが、
   * 2 段階フォールバックの定義上「代表が ACTIVE」⟺「ACTIVE が 1 件以上存在」と一致するため、
   * Prisma 側で variations の some/none に落として DB で絞り込む。
   */
  activeStatus?: string;
};

/**
 * 一覧でソート可能なフィールド。Estimate 自身の列に限る。
 * 代表由来の金額（finalTotal）・状態（activeStatus）は別テーブル/導出のため直接ソート不可（ADR-0051）。
 */
export type EstimateSortField = "estimateNumber" | "estimateDate" | "deadline" | "createdAt";

export type EstimateListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: SortOrder<EstimateSortField>;
};
