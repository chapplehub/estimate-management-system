import { VariationApplicationStateDTO } from "./dto/VariationApplicationStateDTO";

/**
 * バリエーション申請状態クエリサービスインターフェース（CQRS read model の境界・#493）。
 *
 * アプリケーション層が依存する読み取りポート。実装（PrismaVariationApplicationStateQueryService）は
 * infrastructure 層で Prisma を直読みし、免除有無・各申請の §3.6 導出入力を materialize して、
 * ドメインの共有関数（deriveApplicationStatus / VariationApplicationState.reduce /
 * AdvancingVariationPolicy）で DTO を組み立てる（書き込みとのドリフト封じ）。
 */
export interface VariationApplicationStateQueryService {
  /**
   * 見積 ID 配下の全バリエーション（INACTIVE 含む）の申請状態を variationNumber 昇順で返す。
   * 見積が存在しない（＝バリエーションが無い）場合は空配列。
   */
  findByEstimateId(estimateId: string): Promise<VariationApplicationStateDTO[]>;
}
