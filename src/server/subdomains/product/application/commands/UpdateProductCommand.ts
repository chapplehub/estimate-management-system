import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductRepository } from "@subdomains/product/domain/repositories/ProductRepository";
import { ProductCodeDuplicationCheckDomainService } from "@subdomains/product/domain/services/ProductCodeDuplicationCheckDomainService";
import { ProductNameDuplicationCheckDomainService } from "@subdomains/product/domain/services/ProductNameDuplicationCheckDomainService";
import { CostPrice } from "@subdomains/product/domain/values/CostPrice";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductDescription } from "@subdomains/product/domain/values/ProductDescription";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductNote } from "@subdomains/product/domain/values/ProductNote";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";

export type UpdateProductInput = {
  id: string;
  /** 編集画面表示時の version（楽観ロック / ADR-0039） */
  expectedVersion: number;
  category: string;
  code?: string;
  name?: string;
  unit?: string;
  description?: string | null;
  note?: string | null;
  costPrice?: number | null;
};

/**
 * 商品更新コマンド
 *
 * category は変更不可（B011）。入力値と既存値の一致を検証する。
 */
export class UpdateProductCommand {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly productCodeDuplicationCheck: ProductCodeDuplicationCheckDomainService,
    private readonly productNameDuplicationCheck: ProductNameDuplicationCheckDomainService
  ) {}

  async execute(input: UpdateProductInput): Promise<Product> {
    const productId = new ProductId(input.id);
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundEntityError(Product, { id: input.id });
    }

    // B011: カテゴリ変更不可チェック
    const inputCategory = ProductCategory.from(input.category);
    if (!product.category.equals(inputCategory)) {
      throw new BusinessRuleViolationError("商品区分は変更できません");
    }

    // コード変更時の重複チェック（excludeIdで自身除外）
    if (input.code !== undefined) {
      const code = new ProductCode(input.code);
      const isCodeDuplicated = await this.productCodeDuplicationCheck.execute(code, product.id);
      if (isCodeDuplicated) {
        throw new ValidationError(`既に存在する商品コードです: ${code.value}`);
      }
      product.changeCode(code);
    }

    // 名前変更時の重複チェック（excludeIdで自身除外）
    if (input.name !== undefined) {
      const name = new ProductName(input.name);
      const isNameDuplicated = await this.productNameDuplicationCheck.execute(name, product.id);
      if (isNameDuplicated) {
        throw new ValidationError(`既に存在する商品名です: ${name.value}`);
      }
      product.changeName(name);
    }

    if (input.unit !== undefined) {
      product.changeUnit(ProductUnit.from(input.unit));
    }

    if (input.description !== undefined) {
      product.changeDescription(
        input.description !== null ? new ProductDescription(input.description) : null
      );
    }

    if (input.note !== undefined) {
      product.changeNote(input.note !== null ? new ProductNote(input.note) : null);
    }

    if (input.costPrice !== undefined) {
      product.changeCostPrice(input.costPrice !== null ? new CostPrice(input.costPrice) : null);
    }

    return await this.productRepository.update(product, input.expectedVersion);
  }
}
