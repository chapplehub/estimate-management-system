import { EstimateDetailDTO } from "./dto/EstimateDetailDTO";
import { EstimateSummaryDTO } from "./dto/EstimateSummaryDTO";
import { EstimateListOptions, EstimateSearchCriteria } from "./dto/EstimateSearchCriteria";

/**
 * 見積クエリサービスインターフェース（CQRS read model の境界）。
 *
 * アプリケーション層が依存する読み取りポート。実装（PrismaEstimateQueryService）は
 * infrastructure 層で Prisma を直読みし DTO を組み立てる（DDD レイヤリング）。
 */
export interface EstimateQueryService {
  /** 見積番号（自然キー・8桁文字列）で見積詳細を取得する。一致しなければ null。 */
  findByEstimateNumber(estimateNumber: string): Promise<EstimateDetailDTO | null>;

  /**
   * 一覧用の軽量サマリ DTO を検索する。1 行 = 見積 1 件（Estimate 単位）で、
   * 金額・状態は代表バリエーション由来（ADR-0050）。criteria（#349）で見積番号・得意先名・
   * 区分・状態の絞り込みを受け付ける（未指定フィールドは絞り込まない）。
   */
  search(
    criteria: EstimateSearchCriteria,
    options?: EstimateListOptions
  ): Promise<EstimateSummaryDTO[]>;
}
