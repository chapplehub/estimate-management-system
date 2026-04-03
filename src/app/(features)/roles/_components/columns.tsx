"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";

export type RoleRow = {
  id: string;
  roleCd: string;
  name: string;
  positionName: string;
  superiorRoleName: string;
};

export const columns: ColumnDef<RoleRow, unknown>[] = [
  {
    accessorKey: "roleCd",
    header: "役割コード",
    cell: ({ row }) => (
      <Link
        href={`/roles/${row.original.roleCd}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.roleCd}
      </Link>
    ),
  },
  {
    accessorKey: "name",
    header: "役割名",
  },
  {
    accessorKey: "positionName",
    header: "役職",
  },
  {
    accessorKey: "superiorRoleName",
    header: "上位役割",
  },
];
