"use client";

import { getInputProps, getTextareaProps, type FieldMetadata } from "@conform-to/react";
import { inputClassDisabled } from "./formStyles";
import { FkSelectionField } from "./FkSelectionField";

/**
 * 事後修理見積（AFTER_REPAIR）サブタイプ詳細の入力塊（dumb・conform 対応）。
 *
 * 修理対象機器（FkSelectionField）・修理実施日・緊急対応理由・故障内容を 1 セクションへまとめる。
 * 編集（C2）と作成（C1）はフィールド名（afterRepairTargetProductId / afterRepairActualRepairDate /
 * afterRepairEmergencyReason / afterRepairFaultDescription）が一致するため双方で共有する。
 */
type Props = {
  /** afterRepairTargetProductId の input name（hidden 送出用）。 */
  targetProductIdName: string;
  /** 選択中の対象機器 id（hidden value・表示判定用）。 */
  targetProductId: string;
  /** 対象機器の表示文字列（「名称（コード）」）。未選択は null。 */
  targetProductLabel: string | null;
  /** 「選択」クリックの通知（親が商品モーダルを開く）。 */
  onSelectProduct: () => void;
  actualRepairDateField: FieldMetadata<string>;
  emergencyReasonField: FieldMetadata<string>;
  faultDescriptionField: FieldMetadata<string>;
  disabled?: boolean;
};

export function AfterRepairDetailFields({
  targetProductIdName,
  targetProductId,
  targetProductLabel,
  onSelectProduct,
  actualRepairDateField,
  emergencyReasonField,
  faultDescriptionField,
  disabled,
}: Props) {
  return (
    <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">事後修理情報</h2>
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
            htmlFor={actualRepairDateField.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            修理実施日
          </label>
          <input
            {...getInputProps(actualRepairDateField, { type: "date" })}
            disabled={disabled}
            className={inputClassDisabled}
          />
          {actualRepairDateField.errors && (
            <p className="text-red-500 text-xs mt-1">{actualRepairDateField.errors[0]}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor={emergencyReasonField.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            緊急対応理由
          </label>
          <textarea
            {...getTextareaProps(emergencyReasonField)}
            disabled={disabled}
            rows={2}
            className={inputClassDisabled}
          />
          {emergencyReasonField.errors && (
            <p className="text-red-500 text-xs mt-1">{emergencyReasonField.errors[0]}</p>
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
