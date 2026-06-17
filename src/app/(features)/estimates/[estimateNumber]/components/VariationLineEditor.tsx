"use client";

import { getTextareaProps, type FieldMetadata } from "@conform-to/react";
import { SelectionModal } from "@/app/_components/shared/SelectionModal";
import { inputClass } from "../../_shared/formStyles";
import { productSearchFields } from "../../_shared/productSearch";
import { searchProductsForSelection } from "../../_shared/selection-actions";
import { productSelectionColumns, type ProductSelectionRow } from "../../_shared/selectionColumns";
import type { VariationLineEditor as VariationLineEditorState } from "../useVariationLineEditor";
import { toNodePayload } from "../variationLines";
import { LineEditTable } from "./LineEditTable";
import { PreviewRow } from "./PreviewRow";
import { ProductSuggestDialog } from "./ProductSuggestDialog";

type Props = {
  editor: VariationLineEditorState;
  /** 明細ノード配列の hidden field（JSON 化して往復・ADR-0050）。name/errors のみ使用。 */
  nodesField: FieldMetadata<unknown>;
  /** 全体値引の hidden field。name/errors のみ使用。 */
  overallDiscountField: FieldMetadata<number>;
  customerMemoField: FieldMetadata<string | undefined>;
  internalMemoField: FieldMetadata<string | undefined>;
  isPending: boolean;
};

/**
 * バリ明細編集フォームの内側共通領域（C3 追加／C4 編集で共有）。明細テーブル・全体値引・メモ・金額
 * ライブプレビューと、editor state を運ぶ hidden（明細 JSON・全体値引）を描画する。`<form>` シェル・
 * version/分岐 hidden・送信ボタンはラッパが持つ。conform は fields 丸ごとではなく個別 FieldMetadata
 * で注入し、Create/Edit のスキーマ差（submissionType / variationId）をこの部品に漏らさない。
 * 商品選択・周辺サジェストのモーダルは {@link VariationLineEditorOverlays} が `<form>` の外で描画する
 * （ModalSearchForm が内部に `<form>` を持つためネスト form を避ける）。
 */
export function VariationLineEditor({
  editor,
  nodesField,
  overallDiscountField,
  customerMemoField,
  internalMemoField,
  isPending,
}: Props) {
  return (
    <>
      {/* 明細 JSON・全体値引（editor state を hidden で送る）。 */}
      <input
        type="hidden"
        name={nodesField.name}
        value={JSON.stringify(toNodePayload(editor.nodes))}
      />
      <input
        type="hidden"
        name={overallDiscountField.name}
        value={String(editor.overallDiscount)}
      />

      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-700">明細</h3>
        <button
          type="button"
          onClick={() => editor.setProductModalOpen(true)}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded disabled:bg-gray-400"
        >
          明細追加
        </button>
      </div>

      <LineEditTable
        nodes={editor.nodes}
        activeRowId={editor.activeRowId}
        onSelectRow={editor.setActiveRowId}
        onChangeLine={editor.changeLine}
        onRemoveNode={editor.deleteNode}
        onReorderNodes={editor.reorderTopLevel}
        onReorderComponents={editor.reorderInGroup}
      />
      {nodesField.errors && <p className="text-red-500 text-xs mt-1">{nodesField.errors[0]}</p>}

      {/* 全体値引（プレビューに効くため controlled）。 */}
      <div className="mt-6 flex justify-end">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
          全体値引
          <input
            type="number"
            min={0}
            step={1}
            aria-label="全体値引"
            value={editor.overallDiscount}
            onChange={(e) =>
              editor.setOverallDiscount(e.target.value === "" ? 0 : Number(e.target.value))
            }
            className="w-40 border rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </label>
      </div>
      {overallDiscountField.errors && (
        <p className="text-red-500 text-xs mt-1 text-right">{overallDiscountField.errors[0]}</p>
      )}

      {/* バリメモ（conform フィールド）。 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div>
          <label
            htmlFor={customerMemoField.id}
            className="block text-sm font-bold text-gray-700 mb-1"
          >
            顧客メモ
          </label>
          <textarea {...getTextareaProps(customerMemoField)} rows={3} className={inputClass} />
        </div>
        <div>
          <label
            htmlFor={internalMemoField.id}
            className="block text-sm font-bold text-gray-700 mb-1"
          >
            社内メモ
          </label>
          <textarea {...getTextareaProps(internalMemoField)} rows={3} className={inputClass} />
        </div>
      </div>

      {/* 金額ライブプレビュー（概算・確定はドメイン）。 */}
      <div className="mt-6 flex justify-end">
        <dl className="w-full md:w-80 space-y-1 text-sm">
          <PreviewRow label="小計" value={editor.totals.subtotal} />
          <PreviewRow label="税抜合計" value={editor.totals.afterOverallDiscount} />
          <PreviewRow label="消費税（概算）" value={editor.totals.taxAmount} />
          <PreviewRow label="合計（概算）" value={editor.totals.finalTotal} emphasize />
        </dl>
      </div>
    </>
  );
}

/**
 * 明細編集のモーダル（商品選択・周辺サジェスト）。`<form>` の外で描画する＝ModalSearchForm が
 * 内部に `<form>` を持つため、ラッパの `<form>` 内に入れるとネスト form（不正 HTML）になるのを避ける。
 */
export function VariationLineEditorOverlays({ editor }: { editor: VariationLineEditorState }) {
  return (
    <>
      <SelectionModal<ProductSelectionRow>
        isOpen={editor.productModalOpen}
        onClose={() => editor.setProductModalOpen(false)}
        title="明細追加 — 商品を選択"
        searchFields={productSearchFields}
        searchAction={searchProductsForSelection}
        columns={productSelectionColumns}
        onConfirm={editor.handleProductSelect}
        getRowId={(row) => row.id}
        emptyMessage="該当する商品が見つかりません"
      />

      {editor.suggestState && (
        <ProductSuggestDialog
          mainProductName={editor.suggestState.mainName}
          suggestions={editor.suggestState.suggestions}
          onConfirm={editor.confirmSuggestions}
          onCancel={() => editor.setSuggestState(null)}
        />
      )}
    </>
  );
}
