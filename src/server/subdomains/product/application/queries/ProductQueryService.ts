import { ProductDTO } from "./dto/ProductDTO";
import { ProductListOptions, ProductSearchCriteria } from "./dto/ProductSearchCriteria";

/**
 * 商品クエリサービスインターフェース
 */
export interface ProductQueryService {
  findById(id: string): Promise<ProductDTO | null>;
  findByCode(code: string): Promise<ProductDTO | null>;
  findReferencingProducts(id: string): Promise<ProductDTO[]>;
  search(criteria: ProductSearchCriteria, options?: ProductListOptions): Promise<ProductDTO[]>;
}
