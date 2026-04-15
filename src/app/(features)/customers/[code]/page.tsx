import { verifySession } from "@/app/_lib/verifyAuthentication";
import { Badge } from "@/app/_components/shadcnui/badge";
import { getCustomerByCodeQueryFactory } from "@subdomains/customer/application/factories";
import { searchDeliveryLocationsQueryFactory } from "@subdomains/delivery-location/application/factories";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CustomerDeleteForm } from "./CustomerDeleteForm";
import { CustomerStatusForms } from "./CustomerStatusForms";
import { CustomerUpdateForm } from "./CustomerUpdateForm";

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

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link href="/customers" className="text-blue-600 hover:text-blue-800 hover:underline">
          ← 得意先一覧に戻る
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold">得意先編集</h1>
        <Badge variant={customer.isActive ? "default" : "secondary"}>
          {customer.isActive ? "有効" : "無効"}
        </Badge>
      </div>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">取引先情報</h2>
        <CustomerUpdateForm customer={customer} />
      </div>

      {/* 配下の納品先 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">配下の納品先</h2>
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

      <div className="flex gap-4 items-start">
        <CustomerStatusForms
          customerId={customer.id}
          customerCode={customer.code}
          isActive={customer.isActive}
        />
        <CustomerDeleteForm customerId={customer.id} />
      </div>
    </div>
  );
}
