import { ProductDTO } from "./dto/ProductDTO";
import { ProductListOptions, ProductSearchCriteria } from "./dto/ProductSearchCriteria";

/**
 * 商品クエリサービスインターフェース
 */
export interface ProductQueryService {
  findById(id: string): Promise<ProductDTO | null>;
  search(criteria: ProductSearchCriteria, options?: ProductListOptions): Promise<ProductDTO[]>;
}
