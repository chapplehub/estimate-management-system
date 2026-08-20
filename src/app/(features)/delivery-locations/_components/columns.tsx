"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import type { DeliveryLocationDTO } from "@subdomains/delivery-location/application/queries/dto/DeliveryLocationDTO";

export const columns: ColumnDef<DeliveryLocationDTO, unknown>[] = [
  {
    accessorKey: "code",
    header: "コード",
    cell: ({ row }) => (
      <Link
        href={`/delivery-locations/${row.original.code}`}
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
    accessorKey: "customerName",
    header: "得意先",
    cell: ({ row }) => (
      <Link
        href={`/customers/${row.original.customerCode}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.customerName}
      </Link>
    ),
  },
  {
    accessorKey: "prefecture",
    header: "都道府県",
    cell: ({ row }) => row.original.prefecture ?? "-",
  },
  {
    accessorKey: "phoneNumber",
    header: "電話番号",
    cell: ({ row }) => row.original.phoneNumber ?? "-",
  },
  {
    accessorKey: "contactPerson",
    header: "担当者",
    cell: ({ row }) => row.original.contactPerson ?? "-",
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
