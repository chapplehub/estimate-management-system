"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { LIST_FETCH_LIMIT } from "@/app/_lib/searchParams";
import { searchDeliveryLocationsQueryFactory } from "@subdomains/delivery-location/application/factories";
import type { DeliveryLocationSelectionRow } from "./selectionColumns";

/**
 * 納品先を得意先で拘束せず横断検索する（コード／名称の部分一致・有効のみ・#548）。
 *
 * 見積系の `searchDeliveryLocationsForSelection(customerId, criteria)` は customerId 必須
 * （選択中得意先で絞る契約）で流用不可。本画面は納品先を1件確定して単価一覧へ遷移するだけで、
 * 親得意先は候補側の得意先列で曖昧性解消に使うのみのため、customerId を渡さないグローバル検索を
 * フィーチャローカルに新設する（estimate 側 action の「選択中得意先で絞る」契約を薄めない）。
 * 返却行は候補の得意先列表示用に customerCode/customerName を含む（DeliveryLocationDTO が保持）。
 */
export async function searchDeliveryLocationsGlobal(
  criteria: Record<string, string>
): Promise<DeliveryLocationSelectionRow[]> {
  await verifySession();

  const query = searchDeliveryLocationsQueryFactory();
  const locations = await query.execute(
    {
      code: criteria.code?.trim() || undefined,
      name: criteria.name?.trim() || undefined,
      isActive: true,
    },
    { limit: LIST_FETCH_LIMIT, orderBy: { field: "code", direction: "asc" } }
  );

  return locations.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    customerCode: l.customerCode,
    customerName: l.customerName,
  }));
}
