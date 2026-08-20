"use client";

import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";
import { CATEGORY_LABELS } from "./labels";
import type { ProductRow } from "../_components/columns";

export type { ProductRow };

export const selectionColumns: ColumnDef<ProductRow, unknown>[] = [
  {
    accessorKey: "code",
    header: "商品コード",
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
];
