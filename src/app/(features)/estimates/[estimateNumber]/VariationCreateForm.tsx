"use client";

import { getFormProps, getInputProps, getSelectProps, type FieldMetadata } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { SUBMISSION_TYPE_LABELS } from "../_shared/labels";
import { VariationLineEditor, VariationLineEditorOverlays } from "./components/VariationLineEditor";
import { addVariation } from "./actions";
import { useVariationLineEditor } from "./useVariationLineEditor";
import { addVariationNodeSchema } from "./variationSchema";
import type { VariationCreateInitialValues } from "./variationDuplication";

type Props = {
  estimateNumber: string;
  /** 集約ルートの楽観ロックトークン（ADR-0039）。 */
  version: number;
  taxRate: number;
  taxRoundingType: string;
  onCancel: () => void;
} & (
  | { kind: "new" }
  | {
      kind: "duplicate";
      /** 複製元から引き継ぐ初期値（提出区分・明細スナップショット・全体値引・メモ）。 */
      initialValues: VariationCreateInitialValues;
    }
);

/**
 * バリエーション作成フォーム（C3・新規追加／複製プリフィル）。明細編集の作業コピーパイプライン
 * （nodes＝通常明細／セット群 union を client state で保持し submit 時に単一 hidden へ JSON 化・
 * ADR-0047/0050）は {@link useVariationLineEditor}＋{@link VariationLineEditor} に集約し、C4 編集
 * フォームと共有する。この薄いラッパが持つ差分は (1) variationId を持たず提出区分を入力する点、
 * (2) 初期値が複製元 DTO 由来（新規追加は白紙）の 2 点。提出区分は複製＝引き継ぎ固定、新規追加＝
 * 選択（SubmissionTypeField）。version はフォーム由来の楽観ロックトークン（ADR-0039・追加型でも必須）。
 */
export function VariationCreateForm(props: Props) {
  const { estimateNumber, version, taxRate, taxRoundingType, onCancel } = props;
  // 複製は提出区分・明細等を複製元から引き継ぎ、新規追加は白紙で始める。複製/新規は initialValues の
  // 有無ではなくタグ（props.kind）で区別する。
  const initialValues = props.kind === "duplicate" ? props.initialValues : undefined;

  const action = addVariation.bind(null, estimateNumber);
  const { form, fields, isPending } = useServerForm({
    action,
    schema: addVariationNodeSchema,
    defaultValue: {
      version: String(version),
      // 新規＝得意先向け既定／複製＝複製元の値。select(uncontrolled)・hidden いずれの初期値もここを源泉に。
      submissionType: initialValues?.submissionType ?? "CUSTOMER",
      customerMemo: initialValues?.customerMemo ?? "",
      internalMemo: initialValues?.internalMemo ?? "",
    },
  });

  // 作業コピー: 複製は複製元の作業ノード（改訂列ドロップ済み・セット群スナップショット保持）、
  // 新規追加は空配列で開始する。overallDiscount も同様。
  const editor = useVariationLineEditor({
    initialNodes: initialValues?.nodes ?? [],
    initialOverallDiscount: initialValues?.overallDiscount ?? 0,
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
        {/* 楽観ロックトークン（state を hidden で送る）。variationId は持たない。 */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />

        <SubmissionTypeField
          field={fields.submissionType}
          {...(props.kind === "duplicate"
            ? { mode: "fixed" as const, value: props.initialValues.submissionType }
            : { mode: "select" as const, disabled: isPending })}
        />

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

/**
 * 提出区分フィールド。新規追加は選択式（白紙だから）、複製は引き継ぎ固定（変更不可・ADR-0045）。
 *
 * 値の保持は単一: 選択式は uncontrolled な select（conform 管理）、固定は hidden 1 つ。複製時は
 * disabled な select だと FormData に乗らないため、固定ラベル表示＋ hidden で値を運ぶ（提出区分は
 * バリ単位の不変属性・宛先切替の業務操作は存在しない・ADR-0045）。
 */
type SubmissionTypeFieldProps = {
  field: FieldMetadata<string>;
} & ({ mode: "select"; disabled?: boolean } | { mode: "fixed"; value: string });

function SubmissionTypeField(props: SubmissionTypeFieldProps) {
  const { field } = props;
  const error = field.errors?.[0];
  return (
    <div className="mb-6">
      {props.mode === "fixed" ? (
        <>
          <label className="block text-sm font-bold text-gray-700 mb-1">提出区分</label>
          <p className="border rounded px-3 py-2 bg-gray-50 text-gray-700">
            {SUBMISSION_TYPE_LABELS[props.value] ?? props.value}
            <span className="ml-2 text-xs text-gray-500">（複製元から引き継ぎ・変更不可）</span>
          </p>
          <input type="hidden" name={field.name} value={props.value} />
        </>
      ) : (
        <>
          <label htmlFor={field.id} className="block text-sm font-bold text-gray-700 mb-1">
            提出区分
          </label>
          <select
            {...getSelectProps(field)}
            disabled={props.disabled}
            className="border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {Object.entries(SUBMISSION_TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
