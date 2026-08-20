import { ProductQueryService } from "./ProductQueryService";
import { ProductDTO } from "./dto/ProductDTO";

export type GetProductByIdInput = {
  id: string;
};

export class GetProductByIdQuery {
  constructor(private readonly productQueryService: ProductQueryService) {}

  async execute(input: GetProductByIdInput): Promise<ProductDTO | null> {
    return await this.productQueryService.findById(input.id);
  }
}
