import { ProductDTO } from "./dto/ProductDTO";
import { ProductListOptions, ProductSearchCriteria } from "./dto/ProductSearchCriteria";

/**
 * 商品クエリサービスインターフェース
 */
export interface ProductQueryService {
  findById(id: string): Promise<ProductDTO | null>;
  /** 複数 id を一括取得する（見つからない id は結果から除かれる・順序は不定）。 */
  findByIds(ids: string[]): Promise<ProductDTO[]>;
  findByCode(code: string): Promise<ProductDTO | null>;
  findReferencingProducts(id: string): Promise<ProductDTO[]>;
  search(criteria: ProductSearchCriteria, options?: ProductListOptions): Promise<ProductDTO[]>;
}
