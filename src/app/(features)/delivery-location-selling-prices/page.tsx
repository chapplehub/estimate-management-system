import { verifySession } from "@/app/_lib/verifyAuthentication";
import { DeliveryLocationSelector } from "./_components/DeliveryLocationSelector";

/**
 * 納品先別販売単価の納品先未選択画面（#548）。
 *
 * 納品先はパスセグメント（`/delivery-location-selling-prices/[deliveryLocationCd]`）で持つため、
 * この画面は「納品先なしルート＝案内＋セレクタのみ」に構造的に決まる。商品一覧は出さない
 * （納品先なしの一覧は意味を持たない）。
 */
export default async function DeliveryLocationSellingPricesPage() {
  await verifySession();

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">納品先別販売単価</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white shadow-md rounded mx-4 mb-4">
        <p className="text-gray-500">納品先を選択してください</p>
        <DeliveryLocationSelector label="納品先を選択" />
      </div>
    </div>
  );
}
