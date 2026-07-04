"use client";

import { type ColumnDef } from "@/app/_components/shared/DataTable";

/**
 * 納品先グローバル選択行（#548）。全納品先を得意先で拘束せず横断検索するため、
 * 得意先別 #508 の `CompanyRow`（コード＋名称のみ）と異なり親得意先の identity を持つ。
 * 同名納品先（例「第一倉庫」）の曖昧性を候補の得意先列で解消する。
 */
export type DeliveryLocationSelectionRow = {
  id: string;
  code: string;
  name: string;
  customerCode: string;
  customerName: string;
};

/** 納品先の選択カラム（コード／名称／得意先）。得意先列は名称（コード）併記で曖昧性を解消する。 */
export const deliveryLocationSelectionColumns: ColumnDef<DeliveryLocationSelectionRow, unknown>[] =
  [
    { accessorKey: "code", header: "コード" },
    { accessorKey: "name", header: "名称" },
    {
      accessorKey: "customerName",
      header: "得意先",
      cell: ({ row }) => (
        <span>
          {row.original.customerName}（{row.original.customerCode}）
        </span>
      ),
    },
  ];
