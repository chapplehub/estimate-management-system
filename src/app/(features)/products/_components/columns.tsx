"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  isActive: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  INDIVIDUAL: "個別商品",
  CONSUMABLE: "消耗品",
  SET: "セット商品",
};

export const columns: ColumnDef<ProductRow, unknown>[] = [
  {
    accessorKey: "code",
    header: "商品コード",
    cell: ({ row }) => (
      <Link
        href={`/products/${row.original.code}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: "name",
    header: "商品名",
  },
  {
    accessorKey: "category",
    header: "商品区分",
    cell: ({ row }) => (
      <Badge variant="outline">
        {CATEGORY_LABELS[row.original.category] ?? row.original.category}
      </Badge>
    ),
  },
  {
    accessorKey: "unit",
    header: "単位",
  },
  {
    accessorKey: "isActive",
    header: "状態",
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? "default" : "secondary"}>
        {row.original.isActive ? "有効" : "無効"}
      </Badge>
    ),
  },
];
