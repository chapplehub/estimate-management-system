"use client";

import { useMemo } from "react";
import { DataTable } from "@/app/_components/shared/DataTable";
import { createColumns, type DeliveryLocationSellingPriceRow } from "./columns";

/**
 * 納品先別販売単価一覧のテーブル（#548）。カラム定義が納品先コードに依存する（商品コードリンクが
 * `/delivery-location-selling-prices/[deliveryLocationCd]/[productCd]` を指す）ため、Server Component
 * からは createColumns() を直接呼べない（client モジュールの関数呼び出しになる）。deliveryLocationCode
 * を props で受けてクライアント側でカラムを生成する薄い wrapper（得意先別 #508 の逸脱を先回りで吸収）。
 */
export function DeliveryLocationSellingPriceTable({
  deliveryLocationCode,
  items,
}: {
  deliveryLocationCode: string;
  items: DeliveryLocationSellingPriceRow[];
}) {
  const columns = useMemo(() => createColumns(deliveryLocationCode), [deliveryLocationCode]);

  return <DataTable columns={columns} data={items} emptyMessage="該当する商品がありません" />;
}
