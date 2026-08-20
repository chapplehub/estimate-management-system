"use client";

import { getInputProps, getTextareaProps, type FieldMetadata } from "@conform-to/react";
import { inputClassDisabled } from "./formStyles";
import { FkSelectionField } from "./FkSelectionField";

/**
 * 修理見積（事前・REPAIR）サブタイプ詳細の入力塊（dumb・conform 対応）。
 *
 * 修理対象機器（FkSelectionField）・修理予定日・故障内容を 1 セクションへまとめる。編集（C2）と
 * 作成（C1）はサブタイプのフィールド名（repairTargetProductId / repairScheduledRepairDate /
 * repairFaultDescription）が一致するため、本部品を双方で共有する。モーダル状態は親が持ち、
 * 対象機器の表示・hidden 送出・選択通知のみ受け取る。
 */
type Props = {
  /** repairTargetProductId の input name（hidden 送出用）。 */
  targetProductIdName: string;
  /** 選択中の対象機器 id（hidden value・表示判定用）。 */
  targetProductId: string;
  /** 対象機器の表示文字列（「名称（コード）」）。未選択は null。 */
  targetProductLabel: string | null;
  /** 「選択」クリックの通知（親が商品モーダルを開く）。 */
  onSelectProduct: () => void;
  scheduledRepairDateField: FieldMetadata<string>;
  faultDescriptionField: FieldMetadata<string>;
  disabled?: boolean;
};

export function RepairDetailFields({
  targetProductIdName,
  targetProductId,
  targetProductLabel,
  onSelectProduct,
  scheduledRepairDateField,
  faultDescriptionField,
  disabled,
}: Props) {
  return (
    <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">修理情報</h2>
      <input type="hidden" name={targetProductIdName} value={targetProductId} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FkSelectionField
          label="修理対象機器"
          selectedLabel={targetProductLabel}
          onSelect={onSelectProduct}
          disabled={disabled}
          selectAriaLabel="修理対象機器を選択"
        />
        <div>
          <label
            htmlFor={scheduledRepairDateField.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            修理予定日
          </label>
          <input
            {...getInputProps(scheduledRepairDateField, { type: "date" })}
            disabled={disabled}
            className={inputClassDisabled}
          />
          {scheduledRepairDateField.errors && (
            <p className="text-red-500 text-xs mt-1">{scheduledRepairDateField.errors[0]}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor={faultDescriptionField.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            故障内容
          </label>
          <textarea
            {...getTextareaProps(faultDescriptionField)}
            disabled={disabled}
            rows={3}
            className={inputClassDisabled}
          />
          {faultDescriptionField.errors && (
            <p className="text-red-500 text-xs mt-1">{faultDescriptionField.errors[0]}</p>
          )}
        </div>
      </div>
    </section>
  );
}
