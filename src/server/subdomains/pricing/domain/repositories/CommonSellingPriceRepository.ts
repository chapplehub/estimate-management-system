import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { CommonSellingPrice } from "../entities";

/**
 * 共通販売単価リポジトリインターフェース。
 *
 * 時点解決（見積年月日で有効な売単価を引く）は read 関心として価格決定フェーズの
 * QueryService に置くため、本リポジトリは集約単位の取得・永続化に限定する（ADR-0066）。
 * 永続化は親 version＋期間行の差分 upsert（ADR-0032）で行い、楽観ロックは insert/update
 * 分割で扱う（ADR-0039）。
 */
export interface CommonSellingPriceRepository {
  /** 商品IDで集約を取得する。未登録なら null。 */
  findByProductId(productId: ProductId): Promise<CommonSellingPrice | null>;

  /** 新規の共通販売単価集約を保存する（version は 1 で始まる）。 */
  insert(aggregate: CommonSellingPrice): Promise<void>;

  /**
   * 既存の共通販売単価集約を更新する（楽観ロック / ADR-0039）。
   *
   * 期間行は差分 upsert（ADR-0032）で同期し、親 version を条件に更新する。
   *
   * @param expectedVersion 編集画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   保存時点の version と一致しない場合は ConflictError を throw し、後勝ちの変更喪失を防ぐ。
   */
  update(aggregate: CommonSellingPrice, expectedVersion: number): Promise<void>;
}
