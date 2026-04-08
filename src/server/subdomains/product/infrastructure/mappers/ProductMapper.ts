import {
  Product as PrismaProduct,
  ProductRelation as PrismaProductRelation,
  SetProductComponent as PrismaSetProductComponent,
} from "@generated/prisma/client";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ComponentQuantity } from "@subdomains/product/domain/values/ComponentQuantity";
import { CostPrice } from "@subdomains/product/domain/values/CostPrice";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductDescription } from "@subdomains/product/domain/values/ProductDescription";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductNote } from "@subdomains/product/domain/values/ProductNote";
import { ProductRelation } from "@subdomains/product/domain/values/ProductRelation";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { SetProductComponent } from "@subdomains/product/domain/values/SetProductComponent";

/** Prisma include でrelatedProduct/componentProductを含む型 */
type PrismaProductRelationWithProduct = PrismaProductRelation & {
  relatedProduct: PrismaProduct;
};

type PrismaSetProductComponentWithProduct = PrismaSetProductComponent & {
  componentProduct: PrismaProduct;
};

type PrismaProductWithRelations = PrismaProduct & {
  relatedProducts: PrismaProductRelationWithProduct[];
  setComponents: PrismaSetProductComponentWithProduct[];
};

export class ProductMapper {
  static toDomain(prismaProduct: PrismaProductWithRelations): Product {
    const relatedProducts = prismaProduct.relatedProducts.map((r) =>
      ProductRelation.reconstruct(
        new ProductId(r.relatedProductId),
        ProductCategory.from(r.relatedProduct.category),
        new ComponentQuantity(r.quantity)
      )
    );

    const setComponents = prismaProduct.setComponents.map((c) =>
      SetProductComponent.reconstruct(
        new ProductId(c.componentProductId),
        ProductCategory.from(c.componentProduct.category),
        new ComponentQuantity(c.quantity)
      )
    );

    return Product.reconstruct(
      new ProductId(prismaProduct.id),
      new ProductCode(prismaProduct.code),
      new ProductName(prismaProduct.name),
      ProductCategory.from(prismaProduct.category),
      ProductUnit.from(prismaProduct.unit),
      prismaProduct.isActive,
      prismaProduct.description ? new ProductDescription(prismaProduct.description) : null,
      prismaProduct.note ? new ProductNote(prismaProduct.note) : null,
      prismaProduct.costPrice !== null ? new CostPrice(Number(prismaProduct.costPrice)) : null,
      relatedProducts,
      setComponents,
      prismaProduct.createdAt,
      prismaProduct.updatedAt
    );
  }

  static toPrismaCreate(product: Product) {
    return {
      id: product.id.value,
      code: product.code.value,
      name: product.name.value,
      category: product.category.value as "INDIVIDUAL" | "CONSUMABLE" | "SET",
      unit: product.unit.value as "UNIT" | "PIECE" | "ROLL" | "BOX" | "SHEET" | "SET",
      isActive: product.isActive,
      description: product.description?.value ?? null,
      note: product.note?.value ?? null,
      costPrice: product.costPrice?.value ?? null,
    };
  }

  static toPrismaUpdate(product: Product) {
    return {
      code: product.code.value,
      name: product.name.value,
      unit: product.unit.value as "UNIT" | "PIECE" | "ROLL" | "BOX" | "SHEET" | "SET",
      isActive: product.isActive,
      description: product.description?.value ?? null,
      note: product.note?.value ?? null,
      costPrice: product.costPrice?.value ?? null,
      updatedAt: product.updatedAt,
    };
  }
}
