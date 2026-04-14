import { verifySession } from "@/app/_lib/verifyAuthentication";
import { Badge } from "@/app/_components/shadcnui/badge";
import { getDeliveryLocationByCodeQueryFactory } from "@subdomains/delivery-location/application/factories";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function DeliveryLocationDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  await verifySession();

  const query = getDeliveryLocationByCodeQueryFactory();
  const dl = await query.execute({ code });
  if (!dl) {
    notFound();
  }

  const formattedPostalCode = dl.postalCode
    ? `${dl.postalCode.slice(0, 3)}-${dl.postalCode.slice(3)}`
    : "-";

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link
          href="/delivery-locations"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          ← 納品先一覧に戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">納品先管理</h1>

      {/* ブロック1: 取引先基本情報 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">取引先基本情報</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-bold text-gray-700">コード</dt>
            <dd className="mt-1 text-gray-900">{dl.code}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">名前</dt>
            <dd className="mt-1 text-gray-900">{dl.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">郵便番号</dt>
            <dd className="mt-1 text-gray-900">{formattedPostalCode}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">都道府県</dt>
            <dd className="mt-1 text-gray-900">{dl.prefecture ?? "-"}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-bold text-gray-700">住所</dt>
            <dd className="mt-1 text-gray-900">{dl.address ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">電話番号</dt>
            <dd className="mt-1 text-gray-900">{dl.phoneNumber ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">FAX番号</dt>
            <dd className="mt-1 text-gray-900">{dl.faxNumber ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">担当者</dt>
            <dd className="mt-1 text-gray-900">{dl.contactPerson ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">状態</dt>
            <dd className="mt-1">
              <Badge variant={dl.isActive ? "default" : "secondary"}>
                {dl.isActive ? "有効" : "無効"}
              </Badge>
            </dd>
          </div>
        </dl>
      </div>

      {/* ブロック2: 納品先固有情報 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">納品先固有情報</h2>
        <dl className="grid grid-cols-1 gap-4">
          <div>
            <dt className="text-sm font-bold text-gray-700">親得意先</dt>
            <dd className="mt-1">
              <Link
                href={`/customers/${dl.customerCode}`}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {dl.customerName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">配送時注意事項</dt>
            <dd className="mt-1 text-gray-900 whitespace-pre-wrap">{dl.deliveryNotes ?? "なし"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
