import { verifySession } from "@/app/_lib/verifyAuthentication";
import { Badge } from "@/app/_components/shadcnui/badge";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchCommonSellingPriceDetail } from "../_data/queries";
import type { PeriodState } from "../_data/types";

/** 円表示（プロトタイプの yen() に一致）。 */
function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

/** 派生状態のラベルと Badge variant（現在有効/将来/失効）。 */
const STATE_BADGE: Record<
  PeriodState,
  { label: string; variant: "default" | "outline" | "secondary" }
> = {
  current: { label: "現在有効", variant: "default" },
  future: { label: "将来", variant: "outline" },
  lapsed: { label: "失効", variant: "secondary" },
};

export default async function CommonSellingPriceDetailPage({
  params,
}: {
  params: Promise<{ productCd: string }>;
}) {
  await verifySession();
  const { productCd } = await params;

  const detail = await fetchCommonSellingPriceDetail(productCd);
  if (detail == null) {
    notFound();
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link
          href="/common-selling-prices"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          ← 共通売単価一覧に戻る
        </Link>
      </div>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">共通売単価</h1>
      </div>

      {/* 商品情報 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">商品</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-bold text-gray-700">商品コード</dt>
            <dd className="mt-1 text-gray-900">{detail.productCd}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">商品名</dt>
            <dd className="mt-1 text-gray-900">{detail.productName}</dd>
          </div>
        </dl>
      </div>

      {/* 適用期間明細 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">適用期間</h2>
        {detail.periods.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-sm font-bold text-gray-700">適用開始日</th>
                <th className="py-2 text-sm font-bold text-gray-700">適用終了日</th>
                <th className="py-2 text-sm font-bold text-gray-700 text-right">共通売単価</th>
                <th className="py-2 text-sm font-bold text-gray-700">状態</th>
              </tr>
            </thead>
            <tbody>
              {detail.periods.map((period) => {
                const badge = STATE_BADGE[period.state];
                return (
                  <tr key={period.periodId} className="border-b">
                    <td className="py-2 tabular-nums">{period.startDate}</td>
                    <td className="py-2 tabular-nums">
                      {period.endDate ?? <span className="text-gray-500">無期限</span>}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatYen(period.price)}
                    </td>
                    <td className="py-2">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">
            適用期間が未設定です。共通売単価が無いと価格決定が解決できません。
          </p>
        )}
      </div>
    </div>
  );
}
