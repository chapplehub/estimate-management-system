"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import type { EmployeeDTO } from "@subdomains/employee/application/queries/dto/EmployeeDTO";
import { USER_ROLES } from "@server/shared/auth/types";

export const columns: ColumnDef<EmployeeDTO, unknown>[] = [
  {
    accessorKey: "employeeCd",
    header: "従業員コード",
    cell: ({ row }) => (
      <Link
        href={`/employees/${row.original.employeeCd}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.employeeCd}
      </Link>
    ),
  },
  {
    accessorKey: "name",
    header: "名前",
  },
  {
    accessorKey: "departmentName",
    header: "部署",
  },
  {
    accessorKey: "email",
    header: "メールアドレス",
  },
  {
    accessorKey: "role",
    header: "権限",
    cell: ({ row }) => (
      <span
        className={`px-2 py-1 rounded text-xs ${
          row.original.role === USER_ROLES.ADMIN
            ? "bg-red-100 text-red-800"
            : "bg-blue-100 text-blue-800"
        }`}
      >
        {row.original.role === USER_ROLES.ADMIN ? "管理者" : "一般"}
      </span>
    ),
  },
];
