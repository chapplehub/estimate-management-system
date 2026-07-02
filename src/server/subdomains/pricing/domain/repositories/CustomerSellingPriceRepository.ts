import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { CustomerSellingPrice } from "../entities";

/**
 * 得意先別販売単価リポジトリインターフェース。
 *
 * 時点解決（見積年月日で有効な売単価を引く）は read 関心として価格決定フェーズの
 * QueryService に置くため、本リポジトリは集約単位の取得・永続化に限定する（ADR-0066 /
 * 20260624-8tg）。集約の identity は複合自然キー（得意先 × 商品）のため取得 API も両キーを
 * 受ける。insert は append-only、update は差分 sync（編集・適用終了・削除を反映）で永続化し、
 * 楽観ロックは親 version の条件付き更新を insert/update 分割で扱う（ADR-0032 / 0039）。
 */
export interface CustomerSellingPriceRepository {
  /** 得意先ID×商品IDで集約を取得する。未登録なら null。 */
  findByCustomerIdAndProductId(
    customerId: CustomerId,
    productId: ProductId
  ): Promise<CustomerSellingPrice | null>;

  /** 新規の得意先別販売単価集約を保存する（version は 1 で始まる）。 */
  insert(aggregate: CustomerSellingPrice): Promise<void>;

  /**
   * 既存の得意先別販売単価集約を更新する（楽観ロック / ADR-0039）。
   *
   * 期間行は差分 sync（編集の in-place 更新・適用終了・削除を反映）で集約の現在状態へ収束させ、
   * 親 version を条件に更新する（ADR-0032）。
   *
   * @param expectedVersion 編集画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   保存時点の version と一致しない場合は ConflictError を throw し、後勝ちの変更喪失を防ぐ。
   */
  update(aggregate: CustomerSellingPrice, expectedVersion: number): Promise<void>;
}
