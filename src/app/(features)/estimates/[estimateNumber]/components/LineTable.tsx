// "use client" は付けない: 本コンポーネントは client 境界 VariationPanel からのみ import され、
// その client バンドルに含まれる。境界エントリにすると function prop（onSelectRow）が
// Server Action ではないと警告されるため、サブコンポーネントとして扱う。
import type {
  LineDTO,
  SetGroupDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { PRODUCT_CATEGORY_LABELS, formatYen } from "../../_shared/labels";

type Props = {
  lines: (LineDTO | SetGroupDTO)[];
  activeRowId: string | null;
  onSelectRow: (id: string) => void;
};

/**
 * 明細テーブル（⑥）。横スクロール＋左右 sticky（純 CSS）。
 *
 * 行は通常明細（LineRow）とセット群（SetGroupRows = 群ヘッダ＋構成行）の 2 種。導出金額・
 * 表示位置は DTO で確定済みなので再計算しない（ADR-0047）。行アクティブ化はハイライトのみ。
 */
export function LineTable({ lines, activeRowId, onSelectRow }: Props) {
  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 font-bold text-gray-700">
              コード
            </th>
            <th className="px-3 py-2 font-bold text-gray-700">商品名</th>
            <th className="px-3 py-2 font-bold text-gray-700">区分</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">数量</th>
            <th className="px-3 py-2 font-bold text-gray-700">単位</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">単価</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">掛率</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">明細値引</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">改訂価格</th>
            <th className="sticky right-0 z-10 bg-gray-50 px-3 py-2 font-bold text-gray-700 text-right">
              金額
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) =>
            line.kind === "setGroup" ? (
              <SetGroupRows
                key={line.setGroupId}
                group={line}
                activeRowId={activeRowId}
                onSelectRow={onSelectRow}
              />
            ) : (
              <LineRow
                key={line.itemId}
                line={line}
                activeRowId={activeRowId}
                onSelectRow={onSelectRow}
              />
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/** 通常明細・構成明細の 1 行。`indent` で構成明細をインデント表示。 */
function LineRow({
  line,
  activeRowId,
  onSelectRow,
  indent = false,
}: {
  line: LineDTO;
  activeRowId: string | null;
  onSelectRow: (id: string) => void;
  indent?: boolean;
}) {
  const isActive = activeRowId === line.itemId;
  const stickyBg = isActive ? "bg-blue-50" : "bg-white";
  return (
    <tr
      data-active={isActive}
      onClick={() => onSelectRow(line.itemId)}
      className={`border-b cursor-pointer ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
    >
      <td className={`sticky left-0 px-3 py-2 ${stickyBg}`}>{line.productCode}</td>
      <td className={`px-3 py-2 ${indent ? "pl-8 text-gray-600" : ""}`}>{line.itemName}</td>
      <td className="px-3 py-2">
        {PRODUCT_CATEGORY_LABELS[line.productCategory] ?? line.productCategory}
      </td>
      <td className="px-3 py-2 text-right">{line.quantity}</td>
      <td className="px-3 py-2">{line.unit}</td>
      <td className="px-3 py-2 text-right">{formatYen(line.unitPrice)}</td>
      <td className="px-3 py-2 text-right">{line.discountRate.toFixed(2)}</td>
      <td className="px-3 py-2 text-right">
        {line.itemDiscount > 0 ? `-${formatYen(line.itemDiscount)}` : "—"}
      </td>
      {/* 改訂価格は薄字（§8.4 改訂明細のみ） */}
      <td className="px-3 py-2 text-right text-gray-400">
        {line.revisedDeliveryPrice !== null ? formatYen(line.revisedDeliveryPrice) : "—"}
      </td>
      <td className={`sticky right-0 px-3 py-2 text-right font-medium ${stickyBg}`}>
        {formatYen(line.finalAmount)}
      </td>
    </tr>
  );
}

/** セット群（ADR-0047）: 群ヘッダ行（導出金額）＋構成明細行（インデント）。 */
function SetGroupRows({
  group,
  activeRowId,
  onSelectRow,
}: {
  group: SetGroupDTO;
  activeRowId: string | null;
  onSelectRow: (id: string) => void;
}) {
  return (
    <>
      <tr className="border-b bg-amber-50">
        <td className="sticky left-0 z-10 bg-amber-50 px-3 py-2 font-semibold">
          {group.productCode}
        </td>
        <td className="px-3 py-2 font-semibold">🧩 {group.itemName}</td>
        <td className="px-3 py-2">
          {PRODUCT_CATEGORY_LABELS[group.productCategory] ?? group.productCategory}
        </td>
        {/* 群は価格・数量を持たない薄い衛星。中間列は空 */}
        <td className="px-3 py-2" />
        <td className="px-3 py-2" />
        <td className="px-3 py-2" />
        <td className="px-3 py-2" />
        <td className="px-3 py-2" />
        <td className="px-3 py-2" />
        {/* 導出金額（＝構成明細 finalAmount 合計） */}
        <td className="sticky right-0 z-10 bg-amber-50 px-3 py-2 text-right font-semibold">
          {formatYen(group.amount)}
        </td>
      </tr>
      {group.components.map((c) => (
        <LineRow
          key={c.itemId}
          line={c}
          activeRowId={activeRowId}
          onSelectRow={onSelectRow}
          indent
        />
      ))}
    </>
  );
}
