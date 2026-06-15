// "use client" は付けない: client 境界 VariationEditForm からのみ import される（LineTable と同様）。
// dnd-kit のフック（useSortable 等）は client バンドル内で実行されるため directive 不要。
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PRODUCT_CATEGORY_LABELS, formatYen } from "../../_shared/labels";
import { previewLineAmount } from "../previewAmounts";
import type { WorkingLine } from "../variationLines";

type Props = {
  lines: WorkingLine[];
  activeRowId: string | null;
  onSelectRow: (rowId: string) => void;
  onChangeLine: (rowId: string, patch: Partial<WorkingLine>) => void;
  onRemoveLine: (rowId: string) => void;
  /** D&D 並べ替え（配列 index ベース・ADR-0050）。 */
  onReorder: (from: number, to: number) => void;
};

const cellInputClass =
  "w-full border rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-blue-400";
const memoInputClass =
  "mt-1 w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400";

/**
 * 明細編集テーブル（⑥編集 variant・S4）。商品名・単位・コード・区分はスナップショット固定表示、
 * 数量・単価・掛率・明細値引・行メモ2種をインライン編集する。行金額はクライアント簡易ライブ
 * プレビュー（previewLineAmount・確定はドメイン）。改訂価格列は非改訂バリでは常に「—」のため省略。
 * 並べ替えは dnd-kit（縦のみ）。sortOrder は持たず配列順 = 真実（ADR-0050）。
 */
export function LineEditTable({
  lines,
  activeRowId,
  onSelectRow,
  onChangeLine,
  onRemoveLine,
  onReorder,
}: Props) {
  // クリックとドラッグを区別するため 6px 動いてからドラッグ開始。
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = lines.findIndex((l) => l.rowId === active.id);
    const to = lines.findIndex((l) => l.rowId === over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-2 py-2" aria-label="並べ替え" />
            <th className="px-3 py-2 font-bold text-gray-700">コード</th>
            <th className="px-3 py-2 font-bold text-gray-700">商品名</th>
            <th className="px-3 py-2 font-bold text-gray-700">区分</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">数量</th>
            <th className="px-3 py-2 font-bold text-gray-700">単位</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">単価</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">掛率</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">明細値引</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">金額</th>
            <th className="px-3 py-2 font-bold text-gray-700">メモ</th>
            <th className="px-3 py-2 font-bold text-gray-700 text-center">操作</th>
          </tr>
        </thead>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={lines.map((l) => l.rowId)} strategy={verticalListSortingStrategy}>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-gray-400">
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
          </SortableContext>
        </DndContext>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.rowId,
  });
  // restrictToVerticalAxis 前提で縦移動のみ（@dnd-kit/utilities 非依存）。
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  // 空文字は 0 として扱う（保存時にドメイン VO が最終バリデーション）。
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const label = line.itemName;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      data-rowid={line.rowId}
      data-active={isActive}
      onClick={() => onSelectRow(line.rowId)}
      className={`border-b ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
    >
      <td className="px-2 py-2 align-top">
        <button
          type="button"
          aria-label={`並べ替え（${label}）`}
          className="cursor-grab text-gray-400 hover:text-gray-700 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </td>
      <td className="px-3 py-2 align-top">{line.productCode}</td>
      <td className="px-3 py-2 align-top">{line.itemName}</td>
      <td className="px-3 py-2 align-top">
        {PRODUCT_CATEGORY_LABELS[line.productCategory] ?? line.productCategory}
      </td>
      <td className="px-3 py-2 align-top">
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
      <td className="px-3 py-2 align-top">{line.unit}</td>
      <td className="px-3 py-2 align-top">
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
      <td className="px-3 py-2 align-top">
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
      <td className="px-3 py-2 align-top">
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
      <td className="px-3 py-2 align-top text-right font-medium">
        {formatYen(previewLineAmount(line))}
      </td>
      {/* 行メモ（暫定: インライン Textarea rows=2・§9）。 */}
      <td className="px-3 py-2 align-top w-72" onClick={(e) => e.stopPropagation()}>
        <textarea
          aria-label={`顧客メモ（${label}）`}
          rows={2}
          placeholder="顧客メモ"
          value={line.customerMemo}
          onChange={(e) => onChangeLine(line.rowId, { customerMemo: e.target.value })}
          className={memoInputClass}
        />
        <textarea
          aria-label={`社内メモ（${label}）`}
          rows={2}
          placeholder="社内メモ"
          value={line.internalMemo}
          onChange={(e) => onChangeLine(line.rowId, { internalMemo: e.target.value })}
          className={memoInputClass}
        />
      </td>
      <td className="px-3 py-2 align-top text-center">
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
  );
}
