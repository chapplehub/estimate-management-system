"use client";

import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";
import { PRODUCT_CATEGORY_LABELS } from "./labels";

/** SelectionModal 行の最小形（得意先・納品先共通：コード＋名称）。 */
export type CompanyRow = {
  id: string;
  code: string;
  name: string;
};

/** 修理対象機器の選択行（区分バッジ表示用に category を持つ）。 */
export type ProductSelectionRow = {
  id: string;
  code: string;
  name: string;
  category: string;
};

/** 得意先・納品先の選択カラム（コード／名称）。 */
export const companySelectionColumns: ColumnDef<CompanyRow, unknown>[] = [
  { accessorKey: "code", header: "コード" },
  { accessorKey: "name", header: "名称" },
];

/** 修理対象機器の選択カラム（コード／名称／区分）。 */
export const productSelectionColumns: ColumnDef<ProductSelectionRow, unknown>[] = [
  { accessorKey: "code", header: "商品コード" },
  { accessorKey: "name", header: "商品名" },
  {
    accessorKey: "category",
    header: "商品区分",
    cell: ({ row }) => (
      <Badge variant="outline">
        {PRODUCT_CATEGORY_LABELS[row.original.category] ?? row.original.category}
      </Badge>
    ),
  },
];
