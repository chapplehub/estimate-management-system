"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { VariationLineEditor, VariationLineEditorOverlays } from "./components/VariationLineEditor";
import { updateVariationContent } from "./actions";
import { useVariationLineEditor } from "./useVariationLineEditor";
import { updateVariationContentNodeSchema } from "./variationSchema";
import { fromVariationLines } from "./variationLines";

type Props = {
  estimateNumber: string;
  /** 集約ルートの楽観ロックトークン（ADR-0039）。 */
  version: number;
  variation: VariationDTO;
  taxRate: number;
  taxRoundingType: string;
  onCancel: () => void;
};

/**
 * バリ内容編集フォーム（S4/S5・C4）。明細編集の作業コピーパイプライン（nodes＝通常明細／セット群
 * union を client state で保持し submit 時に単一 hidden へ JSON 化・往復形状 A・ADR-0047/0050）は
 * {@link useVariationLineEditor}＋{@link VariationLineEditor} に集約し、C3 追加フォームと共有する。
 * この薄いラッパが持つ差分は (1) 編集対象 variationId を hidden で運ぶ点、(2) 初期値が閲覧 DTO 由来
 * の 2 点。version は hidden で往復（ADR-0039）。確定金額はドメインが唯一の真実（ADR-0033）で保存後
 * DTO で上書きされ、ここでは簡易ライブプレビューのみ表示する。
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
  const editor = useVariationLineEditor({
    initialNodes: fromVariationLines(variation.lines),
    initialOverallDiscount: variation.overallDiscount,
    taxRate,
    taxRoundingType,
  });

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
        {/* 楽観ロックトークン・対象バリ（state を hidden で送る）。 */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />
        <input type="hidden" name={fields.variationId.name} value={variation.variationId} />

        <VariationLineEditor
          editor={editor}
          nodesField={fields.nodes}
          overallDiscountField={fields.overallDiscount}
          customerMemoField={fields.customerMemo}
          internalMemoField={fields.internalMemo}
          isPending={isPending}
        />

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

      <VariationLineEditorOverlays editor={editor} />
    </>
  );
}
