"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";

export type DepartmentRow = {
  id: string;
  departmentCd: string;
  name: string;
  abbreviation: string;
  parentDepartmentName: string;
  displayOrder: number;
  isActive: boolean;
};

export const columns: ColumnDef<DepartmentRow, unknown>[] = [
  {
    accessorKey: "departmentCd",
    header: "部署コード",
    cell: ({ row }) => (
      <Link
        href={`/departments/${row.original.departmentCd}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.departmentCd}
      </Link>
    ),
  },
  {
    accessorKey: "name",
    header: "部署名",
  },
  {
    accessorKey: "abbreviation",
    header: "略称",
  },
  {
    accessorKey: "parentDepartmentName",
    header: "親部署名",
  },
  {
    accessorKey: "displayOrder",
    header: "表示順",
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
