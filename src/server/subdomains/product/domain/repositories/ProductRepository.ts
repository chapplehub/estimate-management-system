import { Product } from "../entities/Product";
import { ProductCode } from "../values/ProductCode";
import { ProductId } from "../values/ProductId";
import { ProductName } from "../values/ProductName";

/**
 * 商品リポジトリインターフェース
 */
export interface ProductRepository {
  /**
   * 新規商品を保存する（version は 1 で始まる）
   */
  insert(product: Product): Promise<Product>;

  /**
   * 既存商品を更新する（楽観ロック / ADR-0039）
   *
   * @param expectedVersion 編集画面表示時に取得した version。
   *   DB の現在値と一致しない場合は ConflictError を throw する
   */
  update(product: Product, expectedVersion: number): Promise<Product>;

  /**
   * 商品を削除する（楽観ロック / ADR-0039 細目3）
   *
   * @param expectedVersion 削除画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   `deleteMany({ where: { id, version } })` の count = 0（version 不一致 or 行の消失）は
   *   ConflictError を throw し、stale な画面を見て下した削除判断による誤削除を防ぐ。
   */
  delete(id: ProductId, expectedVersion: number): Promise<void>;
  findById(id: ProductId): Promise<Product | null>;
  findByCode(code: ProductCode): Promise<Product | null>;
  findByName(name: ProductName): Promise<Product | null>;

  /**
   * 見積・受注で使用中かチェック
   * TODO: Estimateモデル実装時に実装を更新
   */
  existsInEstimateOrOrder(id: ProductId): Promise<boolean>;

  /**
   * 指定商品を周辺商品またはセット構成で参照している商品を取得
   */
  findReferencingProducts(id: ProductId): Promise<Product[]>;

  /**
   * 周辺商品・セット構成内のtargetIdをreplacementIdに一括置換（トランザクション）
   */
  replaceInRelationsAndComponents(targetId: ProductId, replacementId: ProductId): Promise<void>;
}
