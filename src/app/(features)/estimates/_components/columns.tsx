"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";
import { ESTIMATE_TYPE_LABELS, formatDate, formatYen } from "../_shared/labels";

/**
 * 見積一覧の 1 行（presentation 用）。EstimateSummaryDTO から表示に要る項目だけを写す。
 * 金額・締切は整形を cell に集約するため生値（number / Date）で持つ（RSC→Client は
 * React Flight が Date をネイティブ復元するため Date のまま渡せる）。
 */
export type EstimateRow = {
  estimateId: string;
  estimateNumber: string;
  estimateType: string;
  customerName: string;
  deliveryLocationName: string;
  creatorName: string;
  deadline: Date;
  finalTotal: number;
  activeStatus: string;
};

/**
 * 見積一覧の列定義（8 列・左→右、計画 Q1）。得意先と納品先を隣接させる。
 * クリックソートは持たない（DataTable に getSortedRowModel 不在・Q4）。
 */
export const columns: ColumnDef<EstimateRow, unknown>[] = [
  {
    accessorKey: "estimateNumber",
    header: "見積番号",
    cell: ({ row }) => (
      <Link
        href={`/estimates/${row.original.estimateNumber}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.estimateNumber}
      </Link>
    ),
  },
  {
    accessorKey: "estimateType",
    header: "区分",
    cell: ({ row }) => (
      <Badge variant="outline">
        {ESTIMATE_TYPE_LABELS[row.original.estimateType] ?? row.original.estimateType}
      </Badge>
    ),
  },
  {
    accessorKey: "customerName",
    header: "得意先",
  },
  {
    accessorKey: "deliveryLocationName",
    header: "納品先",
  },
  {
    accessorKey: "creatorName",
    header: "作成者",
  },
  {
    accessorKey: "deadline",
    header: "締切",
    cell: ({ row }) => formatDate(row.original.deadline),
  },
  {
    accessorKey: "finalTotal",
    header: "金額",
    cell: ({ row }) => formatYen(row.original.finalTotal),
  },
  {
    // 列見出しは曖昧語「状態」を避け「有効/無効」とする（Q2・CONTEXT.md）。
    // 本 issue で非 null に出せるのは代表バリエーション由来の activeStatus のみ。
    accessorKey: "activeStatus",
    header: "有効/無効",
    cell: ({ row }) => (
      <Badge variant={row.original.activeStatus === "ACTIVE" ? "default" : "secondary"}>
        {row.original.activeStatus === "ACTIVE" ? "有効" : "無効"}
      </Badge>
    ),
  },
];
