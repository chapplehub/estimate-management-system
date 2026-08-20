import { ProductQueryService } from "./ProductQueryService";
import { ProductDTO } from "./dto/ProductDTO";
import { ProductListOptions, ProductSearchCriteria } from "./dto/ProductSearchCriteria";

export class SearchProductsQuery {
  constructor(private readonly productQueryService: ProductQueryService) {}

  async execute(
    criteria: ProductSearchCriteria,
    options?: ProductListOptions
  ): Promise<ProductDTO[]> {
    return await this.productQueryService.search(criteria, options);
  }
}
