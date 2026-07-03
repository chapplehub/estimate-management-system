"use client";

import { useMemo } from "react";
import { DataTable } from "@/app/_components/shared/DataTable";
import { createColumns, type CustomerSellingPriceRow } from "./columns";

/**
 * 得意先別販売単価一覧のテーブル（#508）。カラム定義が得意先コードに依存する（商品コードリンクが
 * `/customer-selling-prices/[customerCd]/[productCd]` を指す）ため、Server Component からは
 * createColumns() を直接呼べない（client モジュールの関数呼び出しになる）。customerCode を
 * props で受けてクライアント側でカラムを生成する薄い wrapper。
 */
export function CustomerSellingPriceTable({
  customerCode,
  items,
}: {
  customerCode: string;
  items: CustomerSellingPriceRow[];
}) {
  const columns = useMemo(() => createColumns(customerCode), [customerCode]);

  return <DataTable columns={columns} data={items} emptyMessage="該当する商品がありません" />;
}
