"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { LIST_FETCH_LIMIT } from "@/app/_lib/searchParams";
import { searchProductsQueryFactory } from "@subdomains/product/application/factories/productQueryFactory";
import type { ProductSearchCriteria } from "@subdomains/product/application/queries/dto/ProductSearchCriteria";
import type { ProductRow } from "../_components/columns";

export async function searchProductsForSelection(
  criteria: Record<string, string>
): Promise<ProductRow[]> {
  await verifySession();

  const searchCriteria: ProductSearchCriteria = {
    code: criteria.code?.trim() || undefined,
    name: criteria.name?.trim() || undefined,
    category: criteria.category || undefined,
    isActive: true, // Always force active-only
  };

  const query = searchProductsQueryFactory();
  const products = await query.execute(searchCriteria, {
    limit: LIST_FETCH_LIMIT,
    orderBy: { field: "code", direction: "asc" },
  });

  return products.map((product) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    category: product.category,
    unit: product.unit,
    isActive: product.isActive,
  }));
}
