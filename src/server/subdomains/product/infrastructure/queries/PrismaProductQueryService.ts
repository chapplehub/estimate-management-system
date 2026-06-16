import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";
import { ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";
import {
  ProductDTO,
  ProductRelationDTO,
  SetProductComponentDTO,
} from "@subdomains/product/application/queries/dto/ProductDTO";
import {
  ProductListOptions,
  ProductSearchCriteria,
} from "@subdomains/product/application/queries/dto/ProductSearchCriteria";

export class PrismaProductQueryService implements ProductQueryService {
  async findById(id: string): Promise<ProductDTO | null> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: this.getIncludeRelations(),
    });

    return product ? this.toDTO(product) : null;
  }

  async findByIds(ids: string[]): Promise<ProductDTO[]> {
    if (ids.length === 0) {
      return [];
    }
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      include: this.getIncludeRelations(),
    });

    return products.map((p) => this.toDTO(p));
  }

  async findByCode(code: string): Promise<ProductDTO | null> {
    const product = await prisma.product.findUnique({
      where: { code },
      include: this.getIncludeRelations(),
    });

    return product ? this.toDTO(product) : null;
  }

  async findReferencingProducts(id: string): Promise<ProductDTO[]> {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { relatedProducts: { some: { relatedProductId: id } } },
          { setComponents: { some: { componentProductId: id } } },
        ],
      },
      include: this.getIncludeRelations(),
    });

    return products.map((p) => this.toDTO(p));
  }

  async search(
    criteria: ProductSearchCriteria,
    options?: ProductListOptions
  ): Promise<ProductDTO[]> {
    const where = this.buildWhereClause(criteria);
    const orderBy = this.buildOrderBy(options);

    const products = await prisma.product.findMany({
      where,
      include: this.getIncludeRelations(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return products.map((p) => this.toDTO(p));
  }

  private buildWhereClause(criteria: ProductSearchCriteria): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};

    if (criteria.code) {
      where.code = { contains: criteria.code, mode: "insensitive" };
    }

    if (criteria.name) {
      where.name = { contains: criteria.name, mode: "insensitive" };
    }

    if (criteria.category) {
      where.category = criteria.category as Prisma.EnumProductCategoryFilter;
    }

    if (criteria.isActive !== undefined) {
      where.isActive = criteria.isActive;
    }

    return where;
  }

  private buildOrderBy(
    options?: ProductListOptions
  ): Prisma.ProductOrderByWithRelationInput | undefined {
    if (!options?.orderBy) {
      return undefined;
    }

    const { field, direction } = options.orderBy;
    return { [field]: direction };
  }

  private getIncludeRelations() {
    return {
      relatedProducts: {
        include: { relatedProduct: true },
      },
      setComponents: {
        include: { componentProduct: true },
      },
    } as const;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDTO(product: any): ProductDTO {
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      unit: product.unit,
      isActive: product.isActive,
      description: product.description,
      note: product.note,
      costPrice: product.costPrice !== null ? Number(product.costPrice) : null,
      relatedProducts: product.relatedProducts.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any): ProductRelationDTO => ({
          relatedProductId: r.relatedProductId,
          relatedProductCode: r.relatedProduct.code,
          relatedProductName: r.relatedProduct.name,
          relatedProductCategory: r.relatedProduct.category,
          quantity: r.quantity,
        })
      ),
      setComponents: product.setComponents.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any): SetProductComponentDTO => ({
          componentProductId: c.componentProductId,
          componentProductCode: c.componentProduct.code,
          componentProductName: c.componentProduct.name,
          componentProductCategory: c.componentProduct.category,
          quantity: c.quantity,
        })
      ),
      version: product.version,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
