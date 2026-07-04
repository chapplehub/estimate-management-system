import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  commonSellingPriceEditQueryFactory,
  customerSellingPriceEditQueryFactory,
  deliveryLocationSellingPriceEditQueryFactory,
} from "@subdomains/pricing/application/factories/pricingQueryFactory";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { Badge } from "@/app/_components/shadcnui/badge";
import { PeriodDetailPanel } from "./PeriodDetailPanel";

export default async function DeliveryLocationSellingPriceDetailPage({
  params,
}: {
  params: Promise<{ deliveryLocationCd: string; productCd: string }>;
}) {
  const session = await verifySession();
  const admin = isAdmin(session);
  const { deliveryLocationCd, productCd } = await params;

  // status 算出とタイムラインの今日マーカーを同一基準日に揃えるため、参照日を一度だけ求めて共有する。
  const referenceDate = toJstCalendarDay(new Date());

  // タイムラインは「納品先別 → 得意先別 → 共通」の3段フォールバックを主＋2従レーンで対比する。
  // ①納品先別 detail と共通（商品コードのみで引ける）を並行取得する。共通は同一商品コードで引ける
  // 既存の編集読みモデルを再利用し BE 追加実装ゼロ。商品が在れば非 null で、上書き／設定なしでも periods は
  // 空配列を返す（#506 と同型）。
  const [detail, commonDetail] = await Promise.all([
    deliveryLocationSellingPriceEditQueryFactory().find({
      deliveryLocationCode: deliveryLocationCd,
      productCode: productCd,
      referenceDate,
    }),
    commonSellingPriceEditQueryFactory().find({
      productCode: productCd,
      referenceDate,
    }),
  ]);
  if (detail == null) {
    notFound();
  }

  // ②得意先別レーンは親得意先コードが detail 取得後に判明するため2段目で引く（detail 依存）。
  // 得意先別が null（当該得意先×商品に得意先別集約が無い等）でも従レーンを空扱いで描画継続する。
  const customerDetail = await customerSellingPriceEditQueryFactory().find({
    customerCode: detail.customerCode,
    productCode: productCd,
    referenceDate,
  });

  // 共通・得意先別が null（商品不在等）でも納品先別が在れば描画は続行する。従レーンは空扱い。
  const commonPeriods = commonDetail?.periods ?? [];
  const customerPeriods = customerDetail?.periods ?? [];

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        {/* 戻り先は納品先選択済みの一覧（#548 が納品先をパスに持つため選択状態を保って戻せる）。 */}
        <Link
          href={`/delivery-location-selling-prices/${detail.deliveryLocationCode}`}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          ← 納品先別販売単価一覧に戻る
        </Link>
      </div>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">納品先別販売単価</h1>
      </div>

      {/* 納品先情報（保守対象の宛先軸）。 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">納品先</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-bold text-gray-700">納品先コード</dt>
            <dd className="mt-1 text-gray-900">{detail.deliveryLocationCode}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">納品先名</dt>
            <dd className="mt-1 flex items-center gap-2 text-gray-900">
              {detail.deliveryLocationName}
              {!detail.deliveryLocationIsActive && <Badge variant="outline">無効</Badge>}
            </dd>
          </div>
        </dl>
      </div>

      {/* 親得意先情報（文脈提示。納品先は親得意先の文脈が無いと意味を成さない・#546）。
          有効フラグは保守の判断材料にならないため DTO が同梱せず、ここでもバッジは出さない。 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">得意先</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-bold text-gray-700">得意先コード</dt>
            <dd className="mt-1 text-gray-900">{detail.customerCode}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">得意先名</dt>
            <dd className="mt-1 text-gray-900">{detail.customerName}</dd>
          </div>
        </dl>
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
              {!detail.productIsActive && <Badge variant="outline">無効</Badge>}
            </dd>
          </div>
        </dl>
      </div>

      {/* 適用期間明細＋操作（UC-2/3/4/5）。表示・操作はクライアント wrapper に委譲。 */}
      <PeriodDetailPanel
        detail={detail}
        customerPeriods={customerPeriods}
        commonPeriods={commonPeriods}
        isAdmin={admin}
        referenceDate={referenceDate}
      />
    </div>
  );
}
