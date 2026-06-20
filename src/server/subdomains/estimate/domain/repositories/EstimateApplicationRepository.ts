import { EstimateApplication } from "@subdomains/estimate/domain/entities";
import { EstimateApplicationId } from "@subdomains/estimate/domain/values/EstimateApplicationId";
import { EstimateApprovalStepId } from "@subdomains/estimate/domain/values/EstimateApprovalStepId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";

/**
 * 見積申請リポジトリインターフェース（§2.2 / §3・ADR-0039/0058）
 *
 * 集約ルート EstimateApplication 単位の 1 リポジトリ（集約ルートごとに 1 リポジトリ）。
 * 子エンティティ（EstimateApprovalStep）・終端イベント（承認/差戻/取下）専用のリポジトリは
 * 設けず、永続化は常に集約ルート EstimateApplication 経由で行う。状態は保存せず行の存在から
 * 導出するため（ADR-0058）、永続化対象はステップ骨格と終端イベント行である。
 *
 * 本集約は対象見積（Estimate / EstimateVariation）には触れない。「1見積1前進バリエーション」の
 * 担保は見積アグリゲートの楽観ロックでアプリ層が行う（ADR-0058）。
 *
 * 検索・一覧取得（承認 Inbox 等）は QueryService を使用すること（本インターフェースは集約の
 * 保存・再構築に必要な最小限の操作のみを提供する）。
 */
export interface EstimateApplicationRepository {
  /**
   * 申請を新規作成する（承認ステップ群を含めて同一トランザクションで永続化する）。
   */
  insert(application: EstimateApplication): Promise<EstimateApplication>;

  /**
   * 申請アグリゲートを更新する（楽観ロック / ADR-0039）。
   *
   * 承認・差戻・取下は子イベント行の挿入を伴うアグリゲート変更であり、その直列化点となる
   * （同一ステップへの承認/差戻の同時実行、最終承認と取下の競合を version で防ぐ・ADR-0058）。
   * version はドメインエンティティに保持せず、本引数で渡す（ADR-0039）。
   *
   * @param expectedVersion 読み込み時に取得した version。保存時点の version と一致しない場合は
   *   ConflictError を throw し、後勝ちの変更喪失を防ぐ。
   */
  update(application: EstimateApplication, expectedVersion: number): Promise<EstimateApplication>;

  /**
   * ID で申請を取得する。
   */
  findById(id: EstimateApplicationId): Promise<EstimateApplication | null>;

  /**
   * 承認ステップ ID から、それを含む申請アグリゲートを取得する。
   *
   * 承認・差戻コマンドの入力は stepId のため、当該ステップが属する申請ルートを引いて
   * アグリゲート単位で操作・保存する（§7.1/§7.2）。
   */
  findByStepId(stepId: EstimateApprovalStepId): Promise<EstimateApplication | null>;

  /**
   * バリエーション ID から申請を取得する（差戻再申請の attempt 採番・履歴参照に使用・§3.2/§6.3）。
   *
   * 同一バリエーションは差戻→再申請で複数の申請（attempt 通番）を履歴として持ちうるため、
   * 全件を返す。
   */
  findByVariationId(variationId: EstimateVariationId): Promise<EstimateApplication[]>;
}
