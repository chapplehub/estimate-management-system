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
   *
   * @deprecated 移行期の互換 API。insert / update へ移行後に削除する（#301）。
   */
  save(estimate: Estimate): Promise<Estimate>;

  /**
   * 見積を新規作成
   */
  insert(estimate: Estimate): Promise<Estimate>;

  /**
   * 既存見積を更新（楽観ロック / ADR-0039）
   *
   * @param expectedVersion 編集画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   保存時点の version と一致しない場合は ConflictError を throw し、後勝ちの変更喪失を防ぐ。
   */
  update(estimate: Estimate, expectedVersion: number): Promise<Estimate>;

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
