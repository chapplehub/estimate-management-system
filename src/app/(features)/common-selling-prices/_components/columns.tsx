"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";
import type { ProductPriceStatus } from "../_data/types";

export type CommonSellingPriceRow = {
  productCd: string;
  productName: string;
  /** 現在有効単価。未設定・失効中は null。 */
  currentPrice: number | null;
  status: ProductPriceStatus;
};

/** 円表示（プロトタイプの yen() に一致）。 */
function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export const columns: ColumnDef<CommonSellingPriceRow, unknown>[] = [
  {
    accessorKey: "productCd",
    header: "商品コード",
    cell: ({ row }) => (
      <Link
        href={`/common-selling-prices/${row.original.productCd}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.productCd}
      </Link>
    ),
  },
  {
    accessorKey: "productName",
    header: "商品名",
  },
  {
    accessorKey: "currentPrice",
    header: "現在有効単価",
    cell: ({ row }) => {
      const { status, currentPrice } = row.original;
      if (status === "active" && currentPrice != null) {
        return <span className="font-medium tabular-nums">{formatYen(currentPrice)}</span>;
      }
      if (status === "unset") {
        return <Badge variant="outline">未設定</Badge>;
      }
      return <Badge variant="secondary">失効中</Badge>;
    },
  },
];
