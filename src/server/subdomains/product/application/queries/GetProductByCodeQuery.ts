import { ProductQueryService } from "./ProductQueryService";
import { ProductDTO } from "./dto/ProductDTO";

export type GetProductByCodeInput = {
  code: string;
};

export class GetProductByCodeQuery {
  constructor(private readonly productQueryService: ProductQueryService) {}

  async execute(input: GetProductByCodeInput): Promise<ProductDTO | null> {
    return await this.productQueryService.findByCode(input.code);
  }
}
