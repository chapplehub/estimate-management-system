"use client";

import Link from "next/link";
import { type ColumnDef } from "@/app/_components/shared/DataTable";
import { Badge } from "@/app/_components/shadcnui/badge";
import type { CustomerSellingPriceListItemDTO } from "@subdomains/pricing/application/queries/dto/CustomerSellingPriceListDTO";
import { formatYenFromDecimal } from "../../../_shared/formatYen";
import { formatPeriod } from "../../../_shared/formatPeriod";

/** 一覧行は BE 読みモデル DTO を素通しする（#473・変換層を挟まない）。 */
export type CustomerSellingPriceRow = CustomerSellingPriceListItemDTO;

/**
 * 得意先別販売単価一覧のカラム定義（#508）。商品コードリンクが得意先コードを含む管理画面
 * （`/customer-selling-prices/[customerCd]/[productCd]`・#507）を指すため、静的配列ではなく
 * 得意先コードを閉じ込めるファクトリで生成する。
 *
 * リンクは全行対象: active/lapsed 行は既存期間の保守へ、none 行は新規登録動線
 * （編集読みモデルの version: null＝新規登録モード）に接続する。
 */
export function createColumns(customerCode: string): ColumnDef<CustomerSellingPriceRow, unknown>[] {
  return [
    {
      accessorKey: "productCode",
      header: "商品コード",
      cell: ({ row }) => (
        <Link
          href={`/customer-selling-prices/${customerCode}/${row.original.productCode}`}
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
      accessorKey: "currentSellingPrice",
      header: "得意先別単価",
      // none（上書きなし）は正常な既定状態のため outline、lapsed は共通一覧の失効中と同じ secondary。
      // 「未設定」は共通層専用語のためこの画面では使わない（正準語は「上書きなし」・#506）。
      cell: ({ row }) => {
        const { priceStatus, currentSellingPrice } = row.original;
        if (priceStatus === "active" && currentSellingPrice != null) {
          return (
            <span className="font-medium tabular-nums">
              {formatYenFromDecimal(currentSellingPrice)}
            </span>
          );
        }
        if (priceStatus === "lapsed") {
          return <Badge variant="secondary">失効中</Badge>;
        }
        return <Badge variant="outline">上書きなし</Badge>;
      },
    },
    {
      accessorKey: "currentPeriodStart",
      header: "適用期間",
      // 現在有効な上書き行の期間のみ表示（有界=開始〜終了・無期限=開始〜無期限）。lapsed/none は
      // 空欄（状態は単価列のバッジが伝える・#513 / 共通一覧と同型）。
      cell: ({ row }) => {
        const { currentPeriodStart, currentPeriodEnd } = row.original;
        if (currentPeriodStart == null) return null;
        return (
          <span className="tabular-nums">{formatPeriod(currentPeriodStart, currentPeriodEnd)}</span>
        );
      },
    },
    {
      accessorKey: "currentCommonSellingPrice",
      header: "共通単価",
      // フォールバック層（共通販売単価）を COALESCE せず並記する（#506）。上書きなし行で
      // 「実際いくらで売られるか」を読み、上書き設定要否を判断する材料になる。
      cell: ({ row }) => {
        const { currentCommonSellingPrice } = row.original;
        if (currentCommonSellingPrice == null) return null;
        return (
          <span className="tabular-nums">{formatYenFromDecimal(currentCommonSellingPrice)}</span>
        );
      },
    },
  ];
}
