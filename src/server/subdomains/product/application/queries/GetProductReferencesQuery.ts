import { ProductQueryService } from "./ProductQueryService";
import { ProductDTO } from "./dto/ProductDTO";

export type GetProductReferencesInput = {
  id: string;
};

export class GetProductReferencesQuery {
  constructor(private readonly productQueryService: ProductQueryService) {}

  async execute(input: GetProductReferencesInput): Promise<ProductDTO[]> {
    return await this.productQueryService.findReferencingProducts(input.id);
  }
}
