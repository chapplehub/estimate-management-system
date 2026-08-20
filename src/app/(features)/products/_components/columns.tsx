"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";
import { CATEGORY_LABELS } from "../_shared/labels";

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  isActive: boolean;
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
