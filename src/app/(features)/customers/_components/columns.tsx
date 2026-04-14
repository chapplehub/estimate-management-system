"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import type { CustomerDTO } from "@subdomains/customer/application/queries/dto/CustomerDTO";

export const columns: ColumnDef<CustomerDTO, unknown>[] = [
  {
    accessorKey: "code",
    header: "コード",
    cell: ({ row }) => (
      <Link
        href={`/customers/${row.original.code}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: "name",
    header: "名前",
  },
  {
    accessorKey: "postalCode",
    header: "郵便番号",
    cell: ({ row }) => {
      const v = row.original.postalCode;
      if (!v) return "-";
      return `${v.slice(0, 3)}-${v.slice(3)}`;
    },
  },
  {
    accessorKey: "prefecture",
    header: "都道府県",
    cell: ({ row }) => row.original.prefecture ?? "-",
  },
  {
    accessorKey: "address",
    header: "住所",
    cell: ({ row }) => row.original.address ?? "-",
  },
  {
    accessorKey: "phoneNumber",
    header: "電話番号",
    cell: ({ row }) => row.original.phoneNumber ?? "-",
  },
  {
    accessorKey: "faxNumber",
    header: "FAX番号",
    cell: ({ row }) => row.original.faxNumber ?? "-",
  },
  {
    accessorKey: "contactPerson",
    header: "担当者",
    cell: ({ row }) => row.original.contactPerson ?? "-",
  },
  {
    accessorKey: "marginRate",
    header: "マージン率",
    cell: ({ row }) => {
      const rate = row.original.marginRate;
      return rate !== null ? `${rate.toFixed(2)}%` : "-";
    },
  },
  {
    accessorKey: "isActive",
    header: "状態",
    cell: ({ row }) => (
      <span
        className={`px-2 py-1 rounded text-xs ${
          row.original.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
        }`}
      >
        {row.original.isActive ? "有効" : "無効"}
      </span>
    ),
  },
];
