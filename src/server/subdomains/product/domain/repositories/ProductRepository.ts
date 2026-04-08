import { Product } from "../entities/Product";
import { ProductCode } from "../values/ProductCode";
import { ProductId } from "../values/ProductId";
import { ProductName } from "../values/ProductName";

/**
 * 商品リポジトリインターフェース
 */
export interface ProductRepository {
  save(product: Product): Promise<Product>;
  delete(id: ProductId): Promise<void>;
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
