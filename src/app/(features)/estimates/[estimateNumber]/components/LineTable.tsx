// "use client" は付けない: 本コンポーネントは client 境界 VariationPanel からのみ import され、
// その client バンドルに含まれる。境界エントリにすると function prop（onSelectRow）が
// Server Action ではないと警告されるため、サブコンポーネントとして扱う。
import type {
  LineDTO,
  SetGroupDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { PRODUCT_CATEGORY_LABELS, formatYen } from "../../_shared/labels";

/** 明細メモの編集パッチ（顧客/社内のいずれか一方ずつ）。 */
export type MemoPatch = { customerMemo?: string; internalMemo?: string };

const memoInputClass =
  "mt-1 w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400";

type Props = {
  lines: (LineDTO | SetGroupDTO)[];
  activeRowId: string | null;
  onSelectRow: (id: string) => void;
  /**
   * メモ列を編集モードにする（改訂元のメモのみ編集・ADR-0059）。既定 false=read-only テキスト表示。
   * read-only でも明細メモを必ず表示する（従来 LineTable はメモ列が無く未表示だったバグの修正）。
   */
  memoEdit?: boolean;
  /** 編集モード時の明細メモ変更ハンドラ（通常明細・構成明細が対象。セット群自身は対象外）。 */
  onChangeMemo?: (itemId: string, patch: MemoPatch) => void;
};

/**
 * 明細テーブル（⑥）。横スクロール＋左右 sticky（純 CSS）。
 *
 * 行は通常明細（LineRow）とセット群（SetGroupRows = 群ヘッダ＋構成行）の 2 種。導出金額・
 * 表示位置は DTO で確定済みなので再計算しない（ADR-0047）。行アクティブ化はハイライトのみ。
 * メモ列は read-only 表示が既定で、`memoEdit` 時のみ構成明細・通常明細を編集可能にする。
 */
export function LineTable({
  lines,
  activeRowId,
  onSelectRow,
  memoEdit = false,
  onChangeMemo,
}: Props) {
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
            <th className="px-3 py-2 font-bold text-gray-700">メモ</th>
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
                memoEdit={memoEdit}
                onChangeMemo={onChangeMemo}
              />
            ) : (
              <LineRow
                key={line.itemId}
                line={line}
                activeRowId={activeRowId}
                onSelectRow={onSelectRow}
                memoEdit={memoEdit}
                onChangeMemo={onChangeMemo}
              />
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * メモセル。read-only は顧客/社内メモをテキスト表示（未入力は「—」）。
 * editable 時は LineEditTable と同じ rows=2 の textarea 2 本（class・aria-label 規約を流用）。
 */
function MemoCell({
  customerMemo,
  internalMemo,
  label,
  editable,
  onChange,
}: {
  customerMemo: string;
  internalMemo: string;
  label: string;
  editable: boolean;
  onChange?: (patch: MemoPatch) => void;
}) {
  if (editable) {
    return (
      <td className="px-3 py-2 align-top w-72" onClick={(e) => e.stopPropagation()}>
        <textarea
          aria-label={`顧客メモ（${label}）`}
          rows={2}
          placeholder="顧客メモ"
          value={customerMemo}
          onChange={(e) => onChange?.({ customerMemo: e.target.value })}
          className={memoInputClass}
        />
        <textarea
          aria-label={`社内メモ（${label}）`}
          rows={2}
          placeholder="社内メモ"
          value={internalMemo}
          onChange={(e) => onChange?.({ internalMemo: e.target.value })}
          className={memoInputClass}
        />
      </td>
    );
  }
  return (
    <td className="px-3 py-2 align-top text-gray-600 whitespace-pre-wrap">
      {customerMemo || internalMemo ? (
        <div className="space-y-1">
          {customerMemo && <div>{customerMemo}</div>}
          {internalMemo && <div className="text-gray-400">{internalMemo}</div>}
        </div>
      ) : (
        "—"
      )}
    </td>
  );
}

/** 通常明細・構成明細の 1 行。`indent` で構成明細をインデント表示。 */
function LineRow({
  line,
  activeRowId,
  onSelectRow,
  memoEdit,
  onChangeMemo,
  indent = false,
}: {
  line: LineDTO;
  activeRowId: string | null;
  onSelectRow: (id: string) => void;
  memoEdit: boolean;
  onChangeMemo?: (itemId: string, patch: MemoPatch) => void;
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
      <MemoCell
        customerMemo={line.customerMemo}
        internalMemo={line.internalMemo}
        label={line.itemName}
        editable={memoEdit}
        onChange={(patch) => onChangeMemo?.(line.itemId, patch)}
      />
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
  memoEdit,
  onChangeMemo,
}: {
  group: SetGroupDTO;
  activeRowId: string | null;
  onSelectRow: (id: string) => void;
  memoEdit: boolean;
  onChangeMemo?: (itemId: string, patch: MemoPatch) => void;
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
        {/* 群自身のメモは編集対象外（本 issue スコープ外）。read-only 表示のみ。 */}
        <MemoCell
          customerMemo={group.customerMemo}
          internalMemo={group.internalMemo}
          label={group.itemName}
          editable={false}
        />
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
          memoEdit={memoEdit}
          onChangeMemo={onChangeMemo}
          indent
        />
      ))}
    </>
  );
}
