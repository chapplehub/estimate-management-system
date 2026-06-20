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
import { cellInputClass, memoInputClass } from "../../_shared/formStyles";
import { PRODUCT_CATEGORY_LABELS, formatYen } from "../../_shared/labels";
import { previewGroupAmount, previewLineAmount } from "../previewAmounts";
import type { WorkingLine, WorkingNode, WorkingSetGroup } from "../variationLines";

type Props = {
  nodes: WorkingNode[];
  activeRowId: string | null;
  onSelectRow: (rowId: string) => void;
  onChangeLine: (rowId: string, patch: Partial<WorkingLine>) => void;
  /** 通常明細・構成明細・セット群いずれも rowId で削除（群カスケード・最後の構成で群自動削除は親が担保）。 */
  onRemoveNode: (rowId: string) => void;
  /** トップレベル（通常明細・群）の D&D 並べ替え（index ベース・ADR-0050）。 */
  onReorderNodes: (from: number, to: number) => void;
  /** 指定セット群内の構成明細の D&D 並べ替え（群内のみ）。 */
  onReorderComponents: (groupRowId: string, from: number, to: number) => void;
};

const COLUMN_COUNT = 12;

/**
 * 明細編集テーブル（⑥編集 variant・S5）。通常明細・セット群（構成明細を入れ子）を描画する。
 *
 * セット群はヘッダ行（価格列は非活性・金額＝構成合計の導出表示）＋インデントした構成行で表す
 * （ADR-0047）。無効構成商品（read-through isActive=false）はインライン警告バッジを出す（ADR-0052）。
 * D&D は set-aware: 群＝トップレベルの並べ替え、構成＝所属群内のみ（dnd-kit・縦のみ）。sortOrder は
 * 持たず配列順 = 真実（ADR-0050）。行金額はクライアント簡易ライブプレビュー（確定はドメイン）。
 */
export function LineEditTable({
  nodes,
  activeRowId,
  onSelectRow,
  onChangeLine,
  onRemoveNode,
  onReorderNodes,
  onReorderComponents,
}: Props) {
  // クリックとドラッグを区別するため 6px 動いてからドラッグ開始。
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // トップレベル（通常明細・群）の並べ替え。
    const fromTop = nodes.findIndex((n) => n.rowId === active.id);
    if (fromTop >= 0) {
      const toTop = nodes.findIndex((n) => n.rowId === over.id);
      if (toTop >= 0) onReorderNodes(fromTop, toTop);
      return;
    }

    // 構成明細の並べ替え（同一群内のみ。群をまたぐ移動は no-op）。
    const owner = nodes.find(
      (n): n is WorkingSetGroup =>
        n.kind === "setGroup" && n.components.some((c) => c.rowId === active.id)
    );
    if (owner) {
      const from = owner.components.findIndex((c) => c.rowId === active.id);
      const to = owner.components.findIndex((c) => c.rowId === over.id);
      if (from >= 0 && to >= 0) onReorderComponents(owner.rowId, from, to);
    }
  };

  // DndContext / SortableContext は <table> の外側に置く（#369）。dnd-kit はアクセシビリティ用の
  // <div>（HiddenText）を自身の直下に描画するため、<table> 直下に置くと <table> の直接の子に
  // <div> が混入し HTML 構造違反 → hydration エラーになる。コンテキストは描画位置非依存なので
  // テーブル外へ出しても並べ替え機能は変わらない。
  return (
    <div className="overflow-x-auto border rounded">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={nodes.map((n) => n.rowId)} strategy={verticalListSortingStrategy}>
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
            <tbody>
              {nodes.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-3 py-6 text-center text-gray-400">
                    明細がありません。「明細追加」から商品を選択してください。
                  </td>
                </tr>
              )}
              {nodes.map((node) =>
                node.kind === "setGroup" ? (
                  <SetGroupRows
                    key={node.rowId}
                    group={node}
                    activeRowId={activeRowId}
                    onSelectRow={onSelectRow}
                    onChangeLine={onChangeLine}
                    onRemoveNode={onRemoveNode}
                  />
                ) : (
                  <EditRow
                    key={node.rowId}
                    line={node}
                    isActive={activeRowId === node.rowId}
                    onSelectRow={onSelectRow}
                    onChangeLine={onChangeLine}
                    onRemoveNode={onRemoveNode}
                  />
                )
              )}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  );
}

/** セット群（ヘッダ行＋構成行）。構成は群内でのみ並べ替え可能な入れ子 SortableContext。 */
function SetGroupRows({
  group,
  activeRowId,
  onSelectRow,
  onChangeLine,
  onRemoveNode,
}: {
  group: WorkingSetGroup;
  activeRowId: string | null;
  onSelectRow: (rowId: string) => void;
  onChangeLine: (rowId: string, patch: Partial<WorkingLine>) => void;
  onRemoveNode: (rowId: string) => void;
}) {
  return (
    <>
      <GroupHeaderRow
        group={group}
        isActive={activeRowId === group.rowId}
        onSelectRow={onSelectRow}
        onRemoveNode={onRemoveNode}
      />
      <SortableContext
        items={group.components.map((c) => c.rowId)}
        strategy={verticalListSortingStrategy}
      >
        {group.components.map((component) => (
          <EditRow
            key={component.rowId}
            line={component}
            isActive={activeRowId === component.rowId}
            indent
            onSelectRow={onSelectRow}
            onChangeLine={onChangeLine}
            onRemoveNode={onRemoveNode}
          />
        ))}
      </SortableContext>
    </>
  );
}

/** セット群ヘッダ行。価格列は非活性、金額＝構成合計の導出表示（ADR-0047）。群削除＝構成カスケード。 */
function GroupHeaderRow({
  group,
  isActive,
  onSelectRow,
  onRemoveNode,
}: {
  group: WorkingSetGroup;
  isActive: boolean;
  onSelectRow: (rowId: string) => void;
  onRemoveNode: (rowId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.rowId,
  });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };
  const amount = previewGroupAmount(group.components);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      data-rowid={group.rowId}
      data-active={isActive}
      data-kind="setGroup"
      onClick={() => onSelectRow(group.rowId)}
      className={`border-b font-medium ${isActive ? "bg-blue-50" : "bg-amber-50 hover:bg-amber-100"}`}
    >
      <td className="px-2 py-2 align-top">
        <button
          type="button"
          aria-label={`並べ替え（${group.itemName}）`}
          className="cursor-grab text-gray-400 hover:text-gray-700 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </td>
      <td className="px-3 py-2 align-top">{group.productCode}</td>
      <td className="px-3 py-2 align-top">
        <span className="inline-flex items-center gap-1">
          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs text-amber-800">セット</span>
          {group.itemName}
        </span>
      </td>
      <td className="px-3 py-2 align-top">{PRODUCT_CATEGORY_LABELS.SET ?? "セット商品"}</td>
      {/* 数量・単価・掛率・明細値引は群では適用不能（価格を持たない薄い衛星・ADR-0047）。 */}
      <td className="px-3 py-2 align-top text-right text-gray-400">—</td>
      <td className="px-3 py-2 align-top">{group.unit}</td>
      <td className="px-3 py-2 align-top text-right text-gray-400">—</td>
      <td className="px-3 py-2 align-top text-right text-gray-400">—</td>
      <td className="px-3 py-2 align-top text-right text-gray-400">—</td>
      <td className="px-3 py-2 align-top text-right font-semibold">{formatYen(amount)}</td>
      <td className="px-3 py-2 align-top text-xs text-gray-500">構成合計</td>
      <td className="px-3 py-2 align-top text-center">
        <button
          type="button"
          aria-label={`セットを削除（${group.itemName}）`}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveNode(group.rowId);
          }}
          className="text-red-600 hover:text-red-800 text-sm font-bold"
        >
          削除
        </button>
      </td>
    </tr>
  );
}

function EditRow({
  line,
  isActive,
  indent = false,
  onSelectRow,
  onChangeLine,
  onRemoveNode,
}: {
  line: WorkingLine;
  isActive: boolean;
  indent?: boolean;
  onSelectRow: (rowId: string) => void;
  onChangeLine: (rowId: string, patch: Partial<WorkingLine>) => void;
  onRemoveNode: (rowId: string) => void;
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
      data-indent={indent}
      onClick={() => onSelectRow(line.rowId)}
      className={`border-b ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
    >
      <td className={`px-2 py-2 align-top ${indent ? "pl-6" : ""}`}>
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
      <td className={`px-3 py-2 align-top ${indent ? "pl-6 text-gray-600" : ""}`}>
        {indent && <span className="mr-1 text-gray-400">└</span>}
        {line.productCode}
      </td>
      <td className="px-3 py-2 align-top">
        <span className="inline-flex items-center gap-1">
          {line.itemName}
          {!line.isActive && (
            <span
              className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700"
              title="この商品は無効化されています（保存は可能ですが確認してください）"
            >
              無効
            </span>
          )}
        </span>
      </td>
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
            onRemoveNode(line.rowId);
          }}
          className="text-red-600 hover:text-red-800 text-sm font-bold"
        >
          削除
        </button>
      </td>
    </tr>
  );
}
