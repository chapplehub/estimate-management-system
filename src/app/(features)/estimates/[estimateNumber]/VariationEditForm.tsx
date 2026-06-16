"use client";

import { getFormProps, getInputProps, getTextareaProps } from "@conform-to/react";
import { useState } from "react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { SelectionModal } from "@/app/_components/shared/SelectionModal";
import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";
import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { formatYen } from "../_shared/labels";
import {
  expandSetComponents,
  getProductLineSnapshot,
  getProductSuggestions,
  searchProductsForSelection,
  type SuggestedProduct,
} from "../_shared/selection-actions";
import { productSelectionColumns, type ProductSelectionRow } from "../_shared/selectionColumns";
import { LineEditTable } from "./components/LineEditTable";
import { ProductSuggestDialog } from "./components/ProductSuggestDialog";
import { previewVariationTotals } from "./previewAmounts";
import { updateVariationContent } from "./actions";
import { updateVariationContentNodeSchema } from "./variationSchema";
import {
  changeNodeLine,
  createWorkingLine,
  createWorkingSetGroup,
  flattenPricedLines,
  fromVariationLines,
  insertNodesBelow,
  removeNode,
  reorderComponents,
  reorderNodes,
  toNodePayload,
  type WorkingLine,
  type WorkingNode,
} from "./variationLines";

type Props = {
  estimateNumber: string;
  /** 集約ルートの楽観ロックトークン（ADR-0039）。 */
  version: number;
  variation: VariationDTO;
  taxRate: number;
  taxRoundingType: string;
  onCancel: () => void;
};

const productSearchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "商品コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "商品名", placeholder: "部分一致" },
];

const inputClass =
  "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline";

/**
 * バリ内容編集フォーム（S4/S5・C4）。明細はモーダル選択・インライン編集・D&D で client state が
 * 真実になるため作業コピー（nodes＝通常明細／セット群の union・overallDiscount）を React state で
 * 保持し、submit 時に単一の hidden へ JSON 化して往復する（往復形状 A・ADR-0047/0050）。version は
 * hidden で往復（ADR-0039）。全体値引はプレビューに効くため controlled state。バリメモは conform
 * フィールド。確定金額はドメインが唯一の真実（ADR-0033）で保存後 DTO で上書きされ、ここでは簡易
 * ライブプレビューのみ表示する。セット商品選択時は構成を自動展開して群ノードを挿入する（ADR-0047）。
 */
export function VariationEditForm({
  estimateNumber,
  version,
  variation,
  taxRate,
  taxRoundingType,
  onCancel,
}: Props) {
  const action = updateVariationContent.bind(null, estimateNumber);
  const { form, fields, isPending } = useServerForm({
    action,
    schema: updateVariationContentNodeSchema,
    defaultValue: {
      version: String(version),
      variationId: variation.variationId,
      customerMemo: variation.customerMemo,
      internalMemo: variation.internalMemo,
    },
  });

  // 作業コピー: 閲覧 DTO の行配列（通常明細 ＋ セット群）をノード union へ写す（往復形状 A・ADR-0047）。
  const [nodes, setNodes] = useState<WorkingNode[]>(() => fromVariationLines(variation.lines));
  const [overallDiscount, setOverallDiscount] = useState(variation.overallDiscount);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  // 本体追加直後の周辺商品サジェスト（提案あり時のみ）。挿入は本体行（mainRowId）の直下。
  const [suggestState, setSuggestState] = useState<{
    mainRowId: string;
    mainName: string;
    suggestions: SuggestedProduct[];
  } | null>(null);

  // 金額プレビューは価格付き末端行（通常明細＋全構成）のフラット列で計算する（群は価格を持たない）。
  const totals = previewVariationTotals({
    lines: flattenPricedLines(nodes),
    overallDiscount,
    taxRate,
    taxRoundingType,
  });

  const changeLine = (rowId: string, patch: Partial<WorkingLine>) => {
    setNodes((prev) => changeNodeLine(prev, rowId, patch));
  };

  const deleteNode = (rowId: string) => {
    setNodes((prev) => removeNode(prev, rowId));
    if (activeRowId === rowId) setActiveRowId(null);
  };

  const reorderTopLevel = (from: number, to: number) => {
    setNodes((prev) => reorderNodes(prev, from, to));
  };

  const reorderInGroup = (groupRowId: string, from: number, to: number) => {
    setNodes((prev) => reorderComponents(prev, groupRowId, from, to));
  };

  // 商品選択: セット商品なら構成を自動展開して群ノードを挿入、通常商品ならスナップショット解決して
  // 通常行を挿入する。挿入位置はアクティブノード直下（構成/群がアクティブなら群の直後＝トップレベル）。
  const handleProductSelect = async (rows: ProductSelectionRow[]) => {
    const picked = rows[0];
    if (!picked) return;

    if (picked.category === "SET") {
      const expanded = await expandSetComponents(picked.id);
      if (!expanded) return;
      const groupRowId = crypto.randomUUID();
      const group = createWorkingSetGroup(groupRowId, expanded, () => crypto.randomUUID());
      setNodes((prev) => insertNodesBelow(prev, activeRowId, [group]));
      setActiveRowId(groupRowId);
      // セット商品は周辺商品サジェストの対象外（構成は自動展開で確定）。
      return;
    }

    const snapshot = await getProductLineSnapshot(picked.id);
    if (!snapshot) return;
    const newLine = createWorkingLine(crypto.randomUUID(), snapshot);
    setNodes((prev) => insertNodesBelow(prev, activeRowId, [newLine]));
    setActiveRowId(newLine.rowId);

    const suggestions = await getProductSuggestions(snapshot.id);
    if (suggestions.length > 0) {
      setSuggestState({ mainRowId: newLine.rowId, mainName: snapshot.name, suggestions });
    }
  };

  // 提案された周辺商品（選択分）を本体直下に通常行として挿入する（数量＝relation・他は新規行既定）。
  const confirmSuggestions = (selected: SuggestedProduct[]) => {
    if (!suggestState) return;
    const peripheralLines = selected.map((s) =>
      createWorkingLine(crypto.randomUUID(), s, { quantity: s.quantity })
    );
    setNodes((prev) => insertNodesBelow(prev, suggestState.mainRowId, peripheralLines));
    setSuggestState(null);
  };

  return (
    <>
      {form.errors && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          {form.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <form {...getFormProps(form)} noValidate>
        {/* 楽観ロックトークン・対象バリ・明細 JSON・全体値引（state を hidden で送る）。 */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />
        <input type="hidden" name={fields.variationId.name} value={variation.variationId} />
        <input
          type="hidden"
          name={fields.nodes.name}
          value={JSON.stringify(toNodePayload(nodes))}
        />
        <input type="hidden" name={fields.overallDiscount.name} value={String(overallDiscount)} />

        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-700">明細</h3>
          <button
            type="button"
            onClick={() => setProductModalOpen(true)}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded disabled:bg-gray-400"
          >
            明細追加
          </button>
        </div>

        <LineEditTable
          nodes={nodes}
          activeRowId={activeRowId}
          onSelectRow={setActiveRowId}
          onChangeLine={changeLine}
          onRemoveNode={deleteNode}
          onReorderNodes={reorderTopLevel}
          onReorderComponents={reorderInGroup}
        />
        {fields.nodes.errors && (
          <p className="text-red-500 text-xs mt-1">{fields.nodes.errors[0]}</p>
        )}

        {/* 全体値引（プレビューに効くため controlled）。 */}
        <div className="mt-6 flex justify-end">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            全体値引
            <input
              type="number"
              min={0}
              step={1}
              aria-label="全体値引"
              value={overallDiscount}
              onChange={(e) =>
                setOverallDiscount(e.target.value === "" ? 0 : Number(e.target.value))
              }
              className="w-40 border rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </label>
        </div>
        {fields.overallDiscount.errors && (
          <p className="text-red-500 text-xs mt-1 text-right">{fields.overallDiscount.errors[0]}</p>
        )}

        {/* バリメモ（conform フィールド）。 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div>
            <label
              htmlFor={fields.customerMemo.id}
              className="block text-sm font-bold text-gray-700 mb-1"
            >
              顧客メモ
            </label>
            <textarea {...getTextareaProps(fields.customerMemo)} rows={3} className={inputClass} />
          </div>
          <div>
            <label
              htmlFor={fields.internalMemo.id}
              className="block text-sm font-bold text-gray-700 mb-1"
            >
              社内メモ
            </label>
            <textarea {...getTextareaProps(fields.internalMemo)} rows={3} className={inputClass} />
          </div>
        </div>

        {/* 金額ライブプレビュー（概算・確定はドメイン）。 */}
        <div className="mt-6 flex justify-end">
          <dl className="w-full md:w-80 space-y-1 text-sm">
            <PreviewRow label="小計" value={totals.subtotal} />
            <PreviewRow label="税抜合計" value={totals.afterOverallDiscount} />
            <PreviewRow label="消費税（概算）" value={totals.taxAmount} />
            <PreviewRow label="合計（概算）" value={totals.finalTotal} emphasize />
          </dl>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded disabled:cursor-not-allowed"
          >
            キャンセル
          </button>
        </div>
      </form>

      <SelectionModal<ProductSelectionRow>
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title="明細追加 — 商品を選択"
        searchFields={productSearchFields}
        searchAction={searchProductsForSelection}
        columns={productSelectionColumns}
        onConfirm={handleProductSelect}
        getRowId={(row) => row.id}
        emptyMessage="該当する商品が見つかりません"
      />

      {suggestState && (
        <ProductSuggestDialog
          mainProductName={suggestState.mainName}
          suggestions={suggestState.suggestions}
          onConfirm={confirmSuggestions}
          onCancel={() => setSuggestState(null)}
        />
      )}
    </>
  );
}

function PreviewRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={[
        "flex justify-between py-1",
        emphasize ? "border-t pt-2 text-lg font-bold text-gray-900" : "text-gray-700",
      ].join(" ")}
    >
      <dt>{label}</dt>
      <dd>{formatYen(value)}</dd>
    </div>
  );
}
