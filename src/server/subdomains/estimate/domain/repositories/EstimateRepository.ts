import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";

/**
 * 見積リポジトリインターフェース
 *
 * 集約ルート Estimate 単位の 1 リポジトリ（集約ルートごとに 1 リポジトリ）。
 * 子エンティティ（EstimateVariation / EstimateItem 等）専用のリポジトリは設けず、
 * 永続化は常に集約ルート Estimate 経由で行う。
 *
 * 検索・一覧取得については EstimateQueryService を使用すること
 * （本インターフェースは集約の保存・再構築に必要な最小限の操作のみを提供する）。
 */
export interface EstimateRepository {
  /**
   * 見積を保存（新規作成・更新）
   */
  save(estimate: Estimate): Promise<Estimate>;

  /**
   * 見積を削除
   */
  delete(id: EstimateId): Promise<void>;

  /**
   * IDで見積を取得
   */
  findById(id: EstimateId): Promise<Estimate | null>;

  /**
   * 見積番号で見積を取得（採番の一意性チェック等で使用）
   */
  findByEstimateNumber(estimateNumber: EstimateNumber): Promise<Estimate | null>;
}
