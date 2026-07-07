import { EstimateApplicationSummaryDTO } from "./dto/EstimateApplicationSummaryDTO";
import {
  EstimateApplicationListOptions,
  EstimateApplicationSearchCriteria,
} from "./dto/EstimateApplicationSearchCriteria";

/**
 * 見積申請一覧検索クエリサービスインターフェース（CQRS read model の境界・#571）。
 *
 * アプリケーション層が依存する読み取りポート。実装
 * （PrismaEstimateApplicationSearchQueryService）は infrastructure 層で Prisma を直読みし、
 * 不変事実を where で絞ってイベント行の存在を最小射影で materialize、書き込みと共有のドメイン純粋関数
 * （deriveApplicationStatus / VariationApplicationState.reduce / deriveAwaitingStepOrder）で還元し、
 * 導出条件を selectApplicationRows で絞って DTO を組み立てる（ADR-20260707-b36）。
 */
export interface EstimateApplicationSearchQueryService {
  /**
   * 検索条件に一致する見積申請一覧行（バリエーション単位）を返す。
   * 対象は申請または承認免除の記録を持つバリエーション（＝バリエーション申請状態 NONE 以外）。
   * ソートは固定（申請日時降順→見積番号昇順→バリエーション番号昇順）。件数上限は options.limit
   * （＝presentation の LIST_FETCH_LIMIT）で受け、フィルタ・ソート後に切り出す。
   */
  search(
    criteria: EstimateApplicationSearchCriteria,
    options?: EstimateApplicationListOptions
  ): Promise<EstimateApplicationSummaryDTO[]>;
}
