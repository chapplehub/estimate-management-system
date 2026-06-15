import { EstimateDetailDTO } from "./dto/EstimateDetailDTO";

/**
 * 見積クエリサービスインターフェース（CQRS read model の境界）。
 *
 * アプリケーション層が依存する読み取りポート。実装（PrismaEstimateQueryService）は
 * infrastructure 層で Prisma を直読みし DTO を組み立てる（DDD レイヤリング）。
 */
export interface EstimateQueryService {
  /** 見積番号（自然キー・8桁文字列）で見積詳細を取得する。一致しなければ null。 */
  findByEstimateNumber(estimateNumber: string): Promise<EstimateDetailDTO | null>;
}
