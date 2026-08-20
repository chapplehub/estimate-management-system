import Link from "next/link";
import { verifySession } from "@/app/_lib/verifyAuthentication";
import { searchCustomersQueryFactory } from "@subdomains/customer/application/factories";
import { DeliveryLocationCreateForm } from "./DeliveryLocationCreateForm";

export default async function DeliveryLocationNewPage() {
  await verifySession();

  const searchCustomersQuery = searchCustomersQueryFactory();
  const customers = await searchCustomersQuery.execute(
    { isActive: true },
    { orderBy: { field: "code", direction: "asc" } }
  );
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));

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

      <h1 className="text-3xl font-bold mb-8">納品先登録</h1>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">納品先情報</h2>
        <DeliveryLocationCreateForm customerOptions={customerOptions} />
      </div>
    </div>
  );
}
