import { verifySession } from "@/app/_lib/verifyAuthentication";
import { CustomerSelector } from "./_components/CustomerSelector";

/**
 * 得意先別販売単価の得意先未選択画面（#508）。
 *
 * 得意先はパスセグメント（`/customer-selling-prices/[customerCd]`）で持つため、この画面は
 * 「得意先なしルート＝案内＋セレクタのみ」に構造的に決まる。商品一覧は出さない（得意先なしの
 * 一覧は意味を持たない）。
 */
export default async function CustomerSellingPricesPage() {
  await verifySession();

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">得意先別販売単価</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white shadow-md rounded mx-4 mb-4">
        <p className="text-gray-500">得意先を選択してください</p>
        <CustomerSelector label="得意先を選択" />
      </div>
    </div>
  );
}
