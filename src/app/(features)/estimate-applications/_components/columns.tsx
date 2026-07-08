"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";
import {
  badgeToneClassName,
  badgeToneOf,
} from "@/app/_components/shared/variationApplicationStateBadge";
import type { EstimateApplicationSummaryDTO } from "@subdomains/estimate/application/queries/dto/EstimateApplicationSummaryDTO";
import { SUBMISSION_TYPE_LABELS, formatDateTime, formatYen } from "../_shared/labels";

/**
 * 見積申請一覧の 1 行（presentation 用）。BE の読み取り DTO をそのまま行に用いる
 * （ADR-0069 の直 type-import。金額・日時は整形を cell に集約するため生値で持つ）。
 */
export type EstimateApplicationRow = EstimateApplicationSummaryDTO;

/**
 * 見積申請一覧の列定義（10 列・左→右）。行はバリエーション単位。
 * クリックソートは持たない（DataTable に getSortedRowModel 不在・BE 既定ソート）。
 * 見積番号セルは詳細ネストルート（#574・未実装のためデッドリンク）へ張る。
 */
export const columns: ColumnDef<EstimateApplicationRow, unknown>[] = [
  {
    accessorKey: "estimateNumber",
    header: "見積番号",
    cell: ({ row }) => (
      <Link
        href={`/estimate-applications/${row.original.estimateNumber}/${row.original.variationNumber}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.estimateNumber}
      </Link>
    ),
  },
  {
    accessorKey: "variationNumber",
    header: "バリ番号",
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
    accessorKey: "submissionType",
    header: "提出区分",
    cell: ({ row }) => (
      <Badge variant="outline">
        {SUBMISSION_TYPE_LABELS[row.original.submissionType] ?? row.original.submissionType}
      </Badge>
    ),
  },
  {
    accessorKey: "finalTotal",
    header: "金額",
    cell: ({ row }) => formatYen(row.original.finalTotal),
  },
  {
    // 申請状態バッジ（label は VO 単一ソース・ADR-0069。tone は code から導出）。
    accessorKey: "applicationState",
    header: "申請状態",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={badgeToneClassName(badgeToneOf(row.original.applicationState.code))}
      >
        {row.original.applicationState.label}
      </Badge>
    ),
  },
  {
    accessorKey: "awaitingRoleName",
    header: "承認待ち役割",
    // PENDING の行のみ値を持ち、非 PENDING は null（DTO 契約）。null は空表示。
    cell: ({ row }) => row.original.awaitingRoleName ?? "",
  },
  {
    accessorKey: "applicantName",
    header: "申請者",
  },
  {
    accessorKey: "appliedAt",
    header: "申請日時",
    cell: ({ row }) => formatDateTime(row.original.appliedAt),
  },
];
