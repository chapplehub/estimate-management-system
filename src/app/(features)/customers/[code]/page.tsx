import { verifySession } from "@/app/_lib/verifyAuthentication";
import { Badge } from "@/app/_components/shadcnui/badge";
import { getCustomerByCodeQueryFactory } from "@subdomains/customer/application/factories";
import { searchDeliveryLocationsQueryFactory } from "@subdomains/delivery-location/application/factories";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  await verifySession();

  const query = getCustomerByCodeQueryFactory();
  const customer = await query.execute({ code });
  if (!customer) {
    notFound();
  }

  const deliveryLocationQuery = searchDeliveryLocationsQueryFactory();
  const deliveryLocations = await deliveryLocationQuery.execute(
    { customerId: customer.id },
    { orderBy: { field: "code", direction: "asc" } }
  );

  const formattedPostalCode = customer.postalCode
    ? `${customer.postalCode.slice(0, 3)}-${customer.postalCode.slice(3)}`
    : "-";

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link href="/customers" className="text-blue-600 hover:text-blue-800 hover:underline">
          ← 得意先一覧に戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">得意先管理</h1>

      {/* ブロック1: 取引先基本情報 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">取引先基本情報</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-bold text-gray-700">コード</dt>
            <dd className="mt-1 text-gray-900">{customer.code}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">名前</dt>
            <dd className="mt-1 text-gray-900">{customer.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">郵便番号</dt>
            <dd className="mt-1 text-gray-900">{formattedPostalCode}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">都道府県</dt>
            <dd className="mt-1 text-gray-900">{customer.prefecture ?? "-"}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-bold text-gray-700">住所</dt>
            <dd className="mt-1 text-gray-900">{customer.address ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">電話番号</dt>
            <dd className="mt-1 text-gray-900">{customer.phoneNumber ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">FAX番号</dt>
            <dd className="mt-1 text-gray-900">{customer.faxNumber ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">担当者</dt>
            <dd className="mt-1 text-gray-900">{customer.contactPerson ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">状態</dt>
            <dd className="mt-1">
              <Badge variant={customer.isActive ? "default" : "secondary"}>
                {customer.isActive ? "有効" : "無効"}
              </Badge>
            </dd>
          </div>
        </dl>
      </div>

      {/* ブロック2: 得意先固有情報 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">得意先固有情報</h2>

        <div className="mb-6">
          <dt className="text-sm font-bold text-gray-700">マージン率</dt>
          <dd className="mt-1 text-gray-900">
            {customer.marginRate !== null ? `${customer.marginRate.toFixed(2)}%` : "未設定"}
          </dd>
        </div>

        <h3 className="text-lg font-semibold mb-3 text-gray-600">配下の納品先</h3>
        {deliveryLocations.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-sm font-bold text-gray-700">コード</th>
                <th className="py-2 text-sm font-bold text-gray-700">名前</th>
                <th className="py-2 text-sm font-bold text-gray-700">状態</th>
              </tr>
            </thead>
            <tbody>
              {deliveryLocations.map((dl) => (
                <tr key={dl.id} className="border-b">
                  <td className="py-2">
                    <Link
                      href={`/delivery-locations/${dl.code}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {dl.code}
                    </Link>
                  </td>
                  <td className="py-2">{dl.name}</td>
                  <td className="py-2">
                    <Badge variant={dl.isActive ? "default" : "secondary"}>
                      {dl.isActive ? "有効" : "無効"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">納品先が登録されていません</p>
        )}
      </div>
    </div>
  );
}
