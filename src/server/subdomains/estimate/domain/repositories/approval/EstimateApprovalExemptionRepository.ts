import { EstimateApprovalExemption } from "@subdomains/estimate/domain/entities";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";

/**
 * 承認免除リポジトリインターフェース（§3.5 / §8・ADR-0054）
 *
 * 集約ルート EstimateApprovalExemption 単位の 1 リポジトリ。免除は生成後に状態が変わらない
 * 不変レコードのため、更新（update）・楽観ロック（version）・削除（delete）は提供しない
 * （履歴で物理削除しない・§3.7）。本集約は対象見積（Estimate / EstimateVariation）には触れない。
 *
 * 検索・一覧取得は QueryService を使用すること。
 */
export interface EstimateApprovalExemptionRepository {
  /**
   * 承認免除を新規作成する（1バリエーション1免除・schema の単純ユニーク・ADR-0054）。
   */
  insert(exemption: EstimateApprovalExemption): Promise<EstimateApprovalExemption>;

  /**
   * バリエーション ID から承認免除を取得する（免除済み判定・見積表示ステータス導出に使用・§9）。
   */
  findByVariationId(variationId: EstimateVariationId): Promise<EstimateApprovalExemption | null>;
}
