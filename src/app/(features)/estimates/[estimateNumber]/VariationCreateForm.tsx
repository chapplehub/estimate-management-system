"use client";

import { getFormProps, getInputProps, getTextareaProps } from "@conform-to/react";
import { useState } from "react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { SelectionModal } from "@/app/_components/shared/SelectionModal";
import { inputClass } from "../_shared/formStyles";
import { SUBMISSION_TYPE_LABELS } from "../_shared/labels";
import { productSearchFields } from "../_shared/productSearch";
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
import { PreviewRow } from "./components/PreviewRow";
import { previewVariationTotals } from "./previewAmounts";
import { addVariation } from "./actions";
import { addVariationNodeSchema } from "./variationSchema";
import type { VariationCreateInitialValues } from "./variationDuplication";
import {
  changeNodeLine,
  createWorkingLine,
  createWorkingSetGroup,
  flattenPricedLines,
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
  taxRate: number;
  taxRoundingType: string;
  /**
   * 複製元から引き継ぐ初期値（提出区分・明細スナップショット・全体値引・メモ）。
   * 新規追加（白紙）のときは undefined。
   */
  initialValues?: VariationCreateInitialValues;
  onCancel: () => void;
};

/**
 * バリエーション作成フォーム（C3・新規追加／複製プリフィル）。C4 編集フォームと同じ作業コピー
 * パイプライン（nodes＝通常明細／セット群 union を client state で保持し submit 時に単一 hidden へ
 * JSON 化・ADR-0047/0050）と共有部品（LineEditTable / previewAmounts / 商品選択・周辺サジェスト）を
 * 再利用する。差分は (1) variationId を持たず提出区分を入力する点、(2) 初期値が複製元 DTO 由来
 * （新規追加は白紙）の 2 点。提出区分は複製＝引き継ぎ固定、新規追加＝選択（SubmissionTypeField）。
 * version はフォーム由来の楽観ロックトークン（ADR-0039・追加型でも必須）。
 */
export function VariationCreateForm({
  estimateNumber,
  version,
  taxRate,
  taxRoundingType,
  initialValues,
  onCancel,
}: Props) {
  const isDuplicate = initialValues !== undefined;
  const action = addVariation.bind(null, estimateNumber);
  const { form, fields, isPending } = useServerForm({
    action,
    schema: addVariationNodeSchema,
    defaultValue: {
      version: String(version),
      customerMemo: initialValues?.customerMemo ?? "",
      internalMemo: initialValues?.internalMemo ?? "",
    },
  });

  // 作業コピー: 複製は複製元の作業ノード（改訂列ドロップ済み・セット群スナップショット保持）、
  // 新規追加は空配列で開始する。overallDiscount も同様。
  const [submissionType, setSubmissionType] = useState<string>(
    initialValues?.submissionType ?? "CUSTOMER"
  );
  const [nodes, setNodes] = useState<WorkingNode[]>(() => initialValues?.nodes ?? []);
  const [overallDiscount, setOverallDiscount] = useState(initialValues?.overallDiscount ?? 0);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [suggestState, setSuggestState] = useState<{
    mainRowId: string;
    mainName: string;
    suggestions: SuggestedProduct[];
  } | null>(null);

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

  // 商品選択（C4 編集フォームと同一）。セット商品は構成展開して群挿入、通常商品はスナップショット挿入。
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
        {/* 楽観ロックトークン・明細 JSON・全体値引（state を hidden で送る）。variationId は持たない。 */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />
        <input
          type="hidden"
          name={fields.nodes.name}
          value={JSON.stringify(toNodePayload(nodes))}
        />
        <input type="hidden" name={fields.overallDiscount.name} value={String(overallDiscount)} />

        <SubmissionTypeField
          fieldName={fields.submissionType.name}
          isDuplicate={isDuplicate}
          value={submissionType}
          onChange={setSubmissionType}
          error={fields.submissionType.errors?.[0]}
          disabled={isPending}
        />

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

/**
 * 提出区分フィールド。新規追加は選択（白紙だから）、複製は引き継ぎ固定（変更不可）。
 *
 * 複製時は disabled な select だと FormData に乗らないため、固定ラベル表示＋ hidden で値を運ぶ
 * （提出区分はバリ単位の不変属性・宛先切替の業務操作は存在しない・ADR-0045）。
 */
function SubmissionTypeField({
  fieldName,
  isDuplicate,
  value,
  onChange,
  error,
  disabled,
}: {
  fieldName: string;
  isDuplicate: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-bold text-gray-700 mb-1">提出区分</label>
      {isDuplicate ? (
        <>
          <p className="border rounded px-3 py-2 bg-gray-50 text-gray-700">
            {SUBMISSION_TYPE_LABELS[value] ?? value}
            <span className="ml-2 text-xs text-gray-500">（複製元から引き継ぎ・変更不可）</span>
          </p>
          <input type="hidden" name={fieldName} value={value} />
        </>
      ) : (
        <select
          name={fieldName}
          aria-label="提出区分"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {Object.entries(SUBMISSION_TYPE_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
