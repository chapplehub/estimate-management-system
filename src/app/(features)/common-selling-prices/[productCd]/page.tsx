import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { commonSellingPriceEditQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { Badge } from "@/app/_components/shadcnui/badge";
import { PeriodDetailPanel } from "./PeriodDetailPanel";

export default async function CommonSellingPriceDetailPage({
  params,
}: {
  params: Promise<{ productCd: string }>;
}) {
  const session = await verifySession();
  const admin = isAdmin(session);
  const { productCd } = await params;

  const detail = await commonSellingPriceEditQueryFactory().find({
    productCode: productCd,
    referenceDate: toJstCalendarDay(new Date()),
  });
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
            <dd className="mt-1 text-gray-900">{detail.productCode}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">商品名</dt>
            <dd className="mt-1 flex items-center gap-2 text-gray-900">
              {detail.productName}
              {!detail.isActive && <Badge variant="outline">無効</Badge>}
            </dd>
          </div>
        </dl>
      </div>

      {/* 適用期間明細＋操作（UC-2/3/4/5）。表示・操作はクライアント wrapper に委譲。 */}
      <PeriodDetailPanel detail={detail} isAdmin={admin} />
    </div>
  );
}
