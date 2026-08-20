import { type ExemptionView } from "@subdomains/estimate/application/queries/dto/EstimateApplicationDetailDTO";
import { formatDateTime } from "../../../_shared/labels";

/**
 * 免除記録（EXEMPTED 枝・§3.1-4）。承認チェーンの代わりに免除の事実（理由・実施者・日時）を
 * 3 行定義リストで示す。免除の状態表現（「承認不要」バッジ）は要約ヘッダに一本化するため、
 * 理由はテキストで出し状態バッジは付けない（同一の免除事実に表示を割らない・CONTEXT「承認免除」）。
 */
export function ExemptionRecord({ exemption }: { exemption: ExemptionView }) {
  return (
    <section className="bg-white shadow-md rounded p-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">免除記録</h2>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="font-bold text-gray-600">免除理由</dt>
        <dd className="text-gray-800">{exemption.reason.label}</dd>
        <dt className="font-bold text-gray-600">実施者</dt>
        <dd className="text-gray-800">{exemption.exemptedByName}</dd>
        <dt className="font-bold text-gray-600">免除日時</dt>
        <dd className="text-gray-800">{formatDateTime(exemption.exemptedAt)}</dd>
      </dl>
    </section>
  );
}
