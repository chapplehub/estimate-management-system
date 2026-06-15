"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { LIST_FETCH_LIMIT } from "@/app/_lib/searchParams";
import { searchCustomersQueryFactory } from "@subdomains/customer/application/factories";
import { searchDeliveryLocationsQueryFactory } from "@subdomains/delivery-location/application/factories";
import {
  getProductByIdQueryFactory,
  searchProductsQueryFactory,
} from "@subdomains/product/application/factories/productQueryFactory";
import type { CompanyRow, ProductSelectionRow } from "./selectionColumns";

/** 明細追加で固定表示する商品スナップショット（id/コード/名称/区分/単位）。 */
export type ProductLineSnapshot = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
};

/**
 * S3 ヘッダー編集の FK 選択（SelectionModal）用 検索サーバーアクション群。
 *
 * いずれも有効（isActive=true）のみを返す。納品先は選択中の得意先で絞り込む
 * （customerId を bind して使う）。得意先変更時のクリア＆再選択は UI 側が担保する。
 */

/** 得意先を検索する（コード／名称の部分一致・有効のみ）。 */
export async function searchCustomersForSelection(
  criteria: Record<string, string>
): Promise<CompanyRow[]> {
  await verifySession();

  const query = searchCustomersQueryFactory();
  const customers = await query.execute(
    {
      code: criteria.code?.trim() || undefined,
      name: criteria.name?.trim() || undefined,
      isActive: true,
    },
    { limit: LIST_FETCH_LIMIT, orderBy: { field: "code", direction: "asc" } }
  );

  return customers.map((c) => ({ id: c.id, code: c.code, name: c.name }));
}

/** 選択中の得意先に属する納品先を検索する（コード／名称の部分一致・有効のみ）。 */
export async function searchDeliveryLocationsForSelection(
  customerId: string,
  criteria: Record<string, string>
): Promise<CompanyRow[]> {
  await verifySession();

  const query = searchDeliveryLocationsQueryFactory();
  const locations = await query.execute(
    {
      customerId,
      code: criteria.code?.trim() || undefined,
      name: criteria.name?.trim() || undefined,
      isActive: true,
    },
    { limit: LIST_FETCH_LIMIT, orderBy: { field: "code", direction: "asc" } }
  );

  return locations.map((l) => ({ id: l.id, code: l.code, name: l.name }));
}

/** 修理対象機器（商品）を検索する（コード／名称の部分一致・有効のみ）。 */
export async function searchProductsForSelection(
  criteria: Record<string, string>
): Promise<ProductSelectionRow[]> {
  await verifySession();

  const query = searchProductsQueryFactory();
  const products = await query.execute(
    {
      code: criteria.code?.trim() || undefined,
      name: criteria.name?.trim() || undefined,
      category: criteria.category || undefined,
      isActive: true,
    },
    { limit: LIST_FETCH_LIMIT, orderBy: { field: "code", direction: "asc" } }
  );

  return products.map((p) => ({ id: p.id, code: p.code, name: p.name, category: p.category }));
}

/**
 * 明細追加で選んだ商品のスナップショット（単位を含む）を引く。
 *
 * 商品選択モーダルの行（ProductSelectionRow）は unit を持たないため、選択確定時に findById で
 * 単位を解決して新規明細へスナップショットする（§8・商品名/単位は作成時凍結）。
 */
export async function getProductLineSnapshot(
  productId: string
): Promise<ProductLineSnapshot | null> {
  await verifySession();

  const product = await getProductByIdQueryFactory().execute({ id: productId });
  if (!product) {
    return null;
  }
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    category: product.category,
    unit: product.unit,
  };
}
