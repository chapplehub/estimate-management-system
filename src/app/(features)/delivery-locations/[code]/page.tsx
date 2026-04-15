import { verifySession } from "@/app/_lib/verifyAuthentication";
import { Badge } from "@/app/_components/shadcnui/badge";
import { getDeliveryLocationByCodeQueryFactory } from "@subdomains/delivery-location/application/factories";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DeliveryLocationUpdateForm } from "./DeliveryLocationUpdateForm";

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

      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold">納品先編集</h1>
        <Badge variant={dl.isActive ? "default" : "secondary"}>
          {dl.isActive ? "有効" : "無効"}
        </Badge>
      </div>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">納品先情報</h2>
        <DeliveryLocationUpdateForm deliveryLocation={dl} />
      </div>
    </div>
  );
}
