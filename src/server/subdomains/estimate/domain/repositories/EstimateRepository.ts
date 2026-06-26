import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { EstimateVariationCopy } from "@subdomains/estimate/domain/values/EstimateVariationCopy";

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
   * 見積を新規作成
   */
  insert(estimate: Estimate): Promise<Estimate>;

  /**
   * 見積を新規作成し、複製系譜（EstimateVariationCopy）も同一トランザクションで永続化する（C6 / ADR-0040）。
   *
   * 系譜は集約に属さない兄弟成果物であり、copies の copiedVariationId はすべて estimate 配下の
   * バリエーションを指す。estimate と系譜をアトミックに保存する。
   */
  insertWithCopies(estimate: Estimate, copies: EstimateVariationCopy[]): Promise<Estimate>;

  /**
   * 既存見積を更新（楽観ロック / ADR-0039）
   *
   * @param expectedVersion 編集画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   保存時点の version と一致しない場合は ConflictError を throw し、後勝ちの変更喪失を防ぐ。
   */
  update(estimate: Estimate, expectedVersion: number): Promise<Estimate>;

  /**
   * version 関門専用に根の version だけを条件付きで +1 する（楽観ロック / ADR-0039・ADR-20260626-dee）。
   *
   * scalar・子エンティティは一切書き換えず、`WHERE id AND version = expectedVersion` の条件付き
   * インクリメント1文のみを発行する。申請 submit のように集約本体を変更せず「1見積1前進」の
   * 直列化トークンだけを進めたい場合に使う。{@link update} と異なり全集約 deleteMany/upsert や
   * refetch を行わないため、直列化トランザクション内で保持するロックを最小化する。
   *
   * @param expectedVersion Preview 時に読んだ version。一致しない（先行更新）または行が消失して
   *   いる場合は count 0 となり ConflictError を throw する。呼び出しが ambient トランザクション内
   *   なら throw でトランザクション全体がロールバックされる。
   */
  bumpVersion(estimateId: EstimateId, expectedVersion: number): Promise<void>;

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
