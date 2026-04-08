import { ValidationError } from "@server/shared/errors/DomainError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductRepository } from "@subdomains/product/domain/repositories/ProductRepository";
import { ProductCodeDuplicationCheckDomainService } from "@subdomains/product/domain/services/ProductCodeDuplicationCheckDomainService";
import { ProductNameDuplicationCheckDomainService } from "@subdomains/product/domain/services/ProductNameDuplicationCheckDomainService";
import { CostPrice } from "@subdomains/product/domain/values/CostPrice";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductDescription } from "@subdomains/product/domain/values/ProductDescription";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductNote } from "@subdomains/product/domain/values/ProductNote";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";

export type CreateProductInput = {
  code: string;
  name: string;
  category: string;
  unit: string;
  description?: string | null;
  note?: string | null;
  costPrice?: number | null;
};

/**
 * 商品作成コマンド
 */
export class CreateProductCommand {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly productCodeDuplicationCheck: ProductCodeDuplicationCheckDomainService,
    private readonly productNameDuplicationCheck: ProductNameDuplicationCheckDomainService
  ) {}

  async execute(input: CreateProductInput): Promise<Product> {
    const code = new ProductCode(input.code);
    const name = new ProductName(input.name);
    const category = ProductCategory.from(input.category);
    const unit = ProductUnit.from(input.unit);

    // B001: 商品コード重複チェック
    const isCodeDuplicated = await this.productCodeDuplicationCheck.execute(code);
    if (isCodeDuplicated) {
      throw new ValidationError(`既に存在する商品コードです: ${code.value}`);
    }

    // B002: 商品名重複チェック
    const isNameDuplicated = await this.productNameDuplicationCheck.execute(name);
    if (isNameDuplicated) {
      throw new ValidationError(`既に存在する商品名です: ${name.value}`);
    }

    const description = input.description ? new ProductDescription(input.description) : null;
    const note = input.note ? new ProductNote(input.note) : null;
    const costPrice =
      input.costPrice !== undefined && input.costPrice !== null
        ? new CostPrice(input.costPrice)
        : null;

    const product = Product.create(code, name, category, unit, description, note, costPrice);

    return await this.productRepository.save(product);
  }
}
