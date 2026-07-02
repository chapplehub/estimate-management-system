"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";
import type { CostPriceListItemDTO } from "@subdomains/pricing/application/queries/dto/CostPriceListItemDTO";
import { formatYenFromDecimal } from "../../_shared/formatYen";
import { formatPeriod } from "../../_shared/formatPeriod";

/** 一覧行は BE 読みモデル DTO を素通しする（ADR-0069・変換層を挟まない）。 */
export type CostPriceRow = CostPriceListItemDTO;

export const columns: ColumnDef<CostPriceRow, unknown>[] = [
  {
    accessorKey: "productCode",
    header: "商品コード",
    // 保守画面（#500 後続）未実装のためデッドリンクだが、ユーザー判断で先行リンクを許容（#501）。
    cell: ({ row }) => (
      <Link
        href={`/cost-prices/${row.original.productCode}`}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.productCode}
      </Link>
    ),
  },
  {
    accessorKey: "productName",
    header: "商品名",
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        {row.original.productName}
        {!row.original.isActive && <Badge variant="outline">無効</Badge>}
      </span>
    ),
  },
  {
    accessorKey: "currentCostPrice",
    header: "現在有効原価",
    cell: ({ row }) => {
      const { priceStatus, currentCostPrice } = row.original;
      if (priceStatus === "active" && currentCostPrice != null) {
        return (
          <span className="font-medium tabular-nums">{formatYenFromDecimal(currentCostPrice)}</span>
        );
      }
      if (priceStatus === "unset") {
        return <Badge variant="outline">未設定</Badge>;
      }
      return <Badge variant="secondary">失効中</Badge>;
    },
  },
  {
    accessorKey: "currentPeriodStart",
    header: "適用期間",
    // 現在有効行の期間のみ表示（有界=開始〜終了・無期限=開始〜無期限）。lapsed/unset は空欄
    // （状態は原価列のバッジが伝える・#501）。
    cell: ({ row }) => {
      const { currentPeriodStart, currentPeriodEnd } = row.original;
      if (currentPeriodStart == null) return null;
      return (
        <span className="tabular-nums">{formatPeriod(currentPeriodStart, currentPeriodEnd)}</span>
      );
    },
  },
];
