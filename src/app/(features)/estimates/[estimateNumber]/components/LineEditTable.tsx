// "use client" は付けない: client 境界 VariationEditForm からのみ import される（LineTable と同様）。
import { PRODUCT_CATEGORY_LABELS, formatYen } from "../../_shared/labels";
import { previewLineAmount } from "../previewAmounts";
import type { WorkingLine } from "../variationLines";

type Props = {
  lines: WorkingLine[];
  activeRowId: string | null;
  onSelectRow: (rowId: string) => void;
  onChangeLine: (rowId: string, patch: Partial<WorkingLine>) => void;
  onRemoveLine: (rowId: string) => void;
};

const cellInputClass =
  "w-full border rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-blue-400";

/**
 * 明細編集テーブル（⑥編集 variant・S4）。商品名・単位・コード・区分はスナップショット固定表示、
 * 数量・単価・掛率・明細値引・行メモ2種をインライン編集する。行金額はクライアント簡易ライブ
 * プレビュー（previewLineAmount・確定はドメイン）。改訂価格は非改訂バリのため常に「—」。
 * sortOrder 列は持たない（配列順 = 真実・ADR-0050）。並べ替えは D&D（S4 後半）で行う。
 */
export function LineEditTable({
  lines,
  activeRowId,
  onSelectRow,
  onChangeLine,
  onRemoveLine,
}: Props) {
  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-2 font-bold text-gray-700">コード</th>
            <th className="px-3 py-2 font-bold text-gray-700">商品名</th>
            <th className="px-3 py-2 font-bold text-gray-700">区分</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">数量</th>
            <th className="px-3 py-2 font-bold text-gray-700">単位</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">単価</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">掛率</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">明細値引</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">改訂価格</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">金額</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={11} className="px-3 py-6 text-center text-gray-400">
                明細がありません。「明細追加」から商品を選択してください。
              </td>
            </tr>
          )}
          {lines.map((line) => (
            <EditRow
              key={line.rowId}
              line={line}
              isActive={activeRowId === line.rowId}
              onSelectRow={onSelectRow}
              onChangeLine={onChangeLine}
              onRemoveLine={onRemoveLine}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditRow({
  line,
  isActive,
  onSelectRow,
  onChangeLine,
  onRemoveLine,
}: {
  line: WorkingLine;
  isActive: boolean;
  onSelectRow: (rowId: string) => void;
  onChangeLine: (rowId: string, patch: Partial<WorkingLine>) => void;
  onRemoveLine: (rowId: string) => void;
}) {
  // 空文字は 0 として扱う（保存時にドメイン VO が最終バリデーション）。
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const label = `${line.itemName}`;

  return (
    <>
      <tr
        data-rowid={line.rowId}
        data-active={isActive}
        onClick={() => onSelectRow(line.rowId)}
        className={`border-b ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
      >
        <td className="px-3 py-2">{line.productCode}</td>
        <td className="px-3 py-2">{line.itemName}</td>
        <td className="px-3 py-2">
          {PRODUCT_CATEGORY_LABELS[line.productCategory] ?? line.productCategory}
        </td>
        <td className="px-3 py-2">
          <input
            type="number"
            min={1}
            step={1}
            aria-label={`数量（${label}）`}
            value={line.quantity}
            onChange={(e) => onChangeLine(line.rowId, { quantity: num(e.target.value) })}
            className={`${cellInputClass} w-20`}
          />
        </td>
        <td className="px-3 py-2">{line.unit}</td>
        <td className="px-3 py-2">
          <input
            type="number"
            min={0}
            step={1}
            aria-label={`単価（${label}）`}
            value={line.unitPrice}
            onChange={(e) => onChangeLine(line.rowId, { unitPrice: num(e.target.value) })}
            className={`${cellInputClass} w-28`}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="number"
            min={0}
            step={0.0001}
            aria-label={`掛率（${label}）`}
            value={line.discountRate}
            onChange={(e) => onChangeLine(line.rowId, { discountRate: num(e.target.value) })}
            className={`${cellInputClass} w-24`}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="number"
            min={0}
            step={1}
            aria-label={`明細値引（${label}）`}
            value={line.itemDiscount}
            onChange={(e) => onChangeLine(line.rowId, { itemDiscount: num(e.target.value) })}
            className={`${cellInputClass} w-24`}
          />
        </td>
        {/* 改訂価格は非改訂バリでは常に null（§8.4・§10）。 */}
        <td className="px-3 py-2 text-right text-gray-400">—</td>
        <td className="px-3 py-2 text-right font-medium">{formatYen(previewLineAmount(line))}</td>
        <td className="px-3 py-2 text-center">
          <button
            type="button"
            aria-label={`明細を削除（${label}）`}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveLine(line.rowId);
            }}
            className="text-red-600 hover:text-red-800 text-sm font-bold"
          >
            削除
          </button>
        </td>
      </tr>
      {/* 行メモ（暫定: インライン Textarea rows=2・§9）。 */}
      <tr className={`border-b ${isActive ? "bg-blue-50" : ""}`}>
        <td className="px-3 pb-3" colSpan={11}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-3">
            <label className="text-xs text-gray-600">
              顧客メモ
              <textarea
                aria-label={`顧客メモ（${label}）`}
                rows={2}
                value={line.customerMemo}
                onChange={(e) => onChangeLine(line.rowId, { customerMemo: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>
            <label className="text-xs text-gray-600">
              社内メモ
              <textarea
                aria-label={`社内メモ（${label}）`}
                rows={2}
                value={line.internalMemo}
                onChange={(e) => onChangeLine(line.rowId, { internalMemo: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>
          </div>
        </td>
      </tr>
    </>
  );
}
