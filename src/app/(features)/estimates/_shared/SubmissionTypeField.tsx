"use client";

import { getSelectProps, type FieldMetadata } from "@conform-to/react";
import { SUBMISSION_TYPE_LABELS } from "./labels";

/**
 * 提出区分フィールド（dumb・conform 対応・ADR-0045）。
 *
 * 提出区分はバリエーション単位の不変属性で、宛先切替の業務操作は存在しない。よって入力は新規時のみ:
 * - `select`: 新規追加（C3）・新規作成（C1）。白紙から選択する。
 * - `fixed`: 複製（C3 duplicate）。複製元から引き継ぎ変更不可。disabled な select は FormData に
 *   乗らないため、固定ラベル表示＋ hidden で値を運ぶ。
 *
 * 値の保持は単一（選択式は uncontrolled な select が conform 管理、固定は hidden 1 つ）。
 */
type SubmissionTypeFieldProps = {
  field: FieldMetadata<string>;
} & ({ mode: "select"; disabled?: boolean } | { mode: "fixed"; value: string });

export function SubmissionTypeField(props: SubmissionTypeFieldProps) {
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
