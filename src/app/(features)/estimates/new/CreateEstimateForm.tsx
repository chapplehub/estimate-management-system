"use client";

import { getFormProps, getInputProps, getSelectProps } from "@conform-to/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { SelectionModal } from "@/app/_components/shared/SelectionModal";
import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { AfterRepairDetailFields } from "../_shared/AfterRepairDetailFields";
import { FkSelectionField } from "../_shared/FkSelectionField";
import { inputClassDisabled } from "../_shared/formStyles";
import { ESTIMATE_TYPE_LABELS, TAX_ROUNDING_TYPE_LABELS } from "../_shared/labels";
import { productSearchFields } from "../_shared/productSearch";
import { RepairDetailFields } from "../_shared/RepairDetailFields";
import {
  companySelectionColumns,
  productSelectionColumns,
  type CompanyRow,
  type ProductSelectionRow,
} from "../_shared/selectionColumns";
import {
  searchCustomersForSelection,
  searchDeliveryLocationsForSelection,
  searchProductsForSelection,
} from "../_shared/selection-actions";
import { SubmissionTypeField } from "../_shared/SubmissionTypeField";
import { resolveEffectiveTaxRate } from "../_shared/tax-rate-actions";
import { formatTaxRatePercent } from "../_shared/tax-rate-format";
import {
  VariationLineEditor,
  VariationLineEditorOverlays,
} from "../[estimateNumber]/components/VariationLineEditor";
import { useVariationLineEditor } from "../[estimateNumber]/useVariationLineEditor";
import { createEstimate } from "./actions";
import { createEstimateSchema } from "./schema";

type DepartmentOption = { id: string; name: string };

type Props = {
  /** 作成者（認証セッションの employeeId から解決・read-only）。 */
  creatorName: string;
  creatorCode: string;
  departments: DepartmentOption[];
  /** 既定の見積年月日 "yyyy-mm-dd"（今日・JST）。 */
  defaultEstimateDate: string;
  /** 既定の締切日 "yyyy-mm-dd"。 */
  defaultDeadline: string;
  /** 既定見積年月日に対する解決済み有効税率（マスタ該当なしは null）。 */
  initialTaxRate: number | null;
};

const companySearchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "名称", placeholder: "部分一致" },
];

/**
 * 見積新規作成の統合フォーム（C1）。
 *
 * ヘッダー（見積区分セレクタで NEW/REPAIR/AFTER_REPAIR を選びサブタイプ欄を切替）と初期バリ1件
 * （提出区分・明細・全体値引・メモ）を 1 フォーム・1 アクションで原子的に保存する。編集画面と
 * 部品・ロジックを共有する: FK 選択は FkSelectionField、サブタイプ詳細は Repair/AfterRepairDetailFields、
 * 提出区分は SubmissionTypeField、明細は useVariationLineEditor＋VariationLineEditor（ADR-0047/0050）。
 *
 * 作成固有の差分: (1) 税率はフォーム入力でなく見積年月日からライブ解決し read-only 表示＆プレビューに
 * 供給（submit で §8.7 再確定・ADR-0056）、(2) estimateType を選択する（編集は固定）、(3) version を
 * 持たない（新規採番）。税率の確定値は Server Action 側で導出するためフォームには税率欄を置かない。
 */
export function CreateEstimateForm({
  creatorName,
  creatorCode,
  departments,
  defaultEstimateDate,
  defaultDeadline,
  initialTaxRate,
}: Props) {
  const router = useRouter();

  const { form, fields, isPending } = useServerForm({
    action: createEstimate,
    schema: createEstimateSchema,
    defaultValue: {
      submissionType: "CUSTOMER",
      customerMemo: "",
      internalMemo: "",
    },
  });

  // 見積区分・見積年月日・税端数区分・税率は表示連動のためローカル state で持つ（プレビュー・
  // サブタイプ切替に効く）。FK はモーダル駆動のため hidden で送る。
  const [estimateType, setEstimateType] = useState("NEW");
  const [estimateDate, setEstimateDate] = useState(defaultEstimateDate);
  const [taxRoundingType, setTaxRoundingType] = useState("ROUND_DOWN");
  const [taxRate, setTaxRate] = useState<number | null>(initialTaxRate);
  const [, startTaxResolve] = useTransition();

  const [customer, setCustomer] = useState({ id: "", code: "", name: "" });
  const [deliveryLocation, setDeliveryLocation] = useState({ id: "", code: "", name: "" });
  const [targetProduct, setTargetProduct] = useState({ id: "", code: "", name: "" });

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);

  // 見積年月日の変更に追従して有効税率をライブ解決する（編集画面と同じ findEffectiveAt・§A.1）。
  const handleEstimateDateChange = (value: string) => {
    setEstimateDate(value);
    startTaxResolve(async () => {
      setTaxRate(await resolveEffectiveTaxRate(value));
    });
  };

  const handleCustomerSelect = (rows: CompanyRow[]) => {
    const picked = rows[0];
    if (!picked) return;
    setCustomer({ id: picked.id, code: picked.code, name: picked.name });
    // 得意先を変えたら納品先は不整合になるためクリアして再選択させる（集約をまたぐ整合）。
    setDeliveryLocation({ id: "", code: "", name: "" });
  };

  const handleDeliverySelect = (rows: CompanyRow[]) => {
    const picked = rows[0];
    if (!picked) return;
    setDeliveryLocation({ id: picked.id, code: picked.code, name: picked.name });
  };

  const handleProductSelect = (rows: ProductSelectionRow[]) => {
    const picked = rows[0];
    if (!picked) return;
    setTargetProduct({ id: picked.id, code: picked.code, name: picked.name });
  };

  // 明細編集器（新規作成は白紙＝空ノード・全体値引0で開始）。プレビュー税率はライブ解決値。
  const editor = useVariationLineEditor({
    initialNodes: [],
    initialOverallDiscount: 0,
    taxRate: taxRate ?? 0,
    taxRoundingType,
  });

  const isRepair = estimateType === "REPAIR";
  const isAfterRepair = estimateType === "AFTER_REPAIR";
  const targetProductLabel = targetProduct.id
    ? `${targetProduct.name}（${targetProduct.code}）`
    : null;

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
        {/* モーダル駆動 FK は state を hidden で送る。 */}
        <input type="hidden" name={fields.customerId.name} value={customer.id} />
        <input type="hidden" name={fields.deliveryLocationId.name} value={deliveryLocation.id} />

        <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-500">基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 見積区分（サブタイプ欄の表示を切り替える） */}
            <div>
              <label
                htmlFor={fields.estimateType.id}
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                見積区分
              </label>
              <select
                id={fields.estimateType.id}
                name={fields.estimateType.name}
                value={estimateType}
                onChange={(e) => setEstimateType(e.target.value)}
                disabled={isPending}
                className={inputClassDisabled}
              >
                {Object.entries(ESTIMATE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {fields.estimateType.errors && (
                <p className="text-red-500 text-xs mt-1">{fields.estimateType.errors[0]}</p>
              )}
            </div>

            {/* 作成者（read-only） */}
            <div>
              <span className="block text-gray-700 text-sm font-bold mb-2">作成者</span>
              <p className="text-gray-900 py-2">
                {creatorName}（{creatorCode}）
              </p>
            </div>

            {/* 得意先（SelectionModal） */}
            <FkSelectionField
              label="得意先"
              selectedLabel={customer.id ? `${customer.name}（${customer.code}）` : null}
              onSelect={() => setCustomerModalOpen(true)}
              disabled={isPending}
              selectAriaLabel="得意先を選択"
              error={fields.customerId.errors?.[0]}
            />

            {/* 納品先（選択中得意先で絞り込み） */}
            <FkSelectionField
              label="納品先"
              selectedLabel={
                deliveryLocation.id ? `${deliveryLocation.name}（${deliveryLocation.code}）` : null
              }
              onSelect={() => setDeliveryModalOpen(true)}
              disabled={isPending || !customer.id}
              selectAriaLabel="納品先を選択"
              error={fields.deliveryLocationId.errors?.[0]}
            />

            {/* 部署（プレースホルダ必須選択。自動解決は後続 #374） */}
            <div>
              <label
                htmlFor={fields.departmentId.id}
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                部署
              </label>
              <select
                {...getSelectProps(fields.departmentId)}
                defaultValue=""
                disabled={isPending}
                className={inputClassDisabled}
              >
                <option value="" disabled>
                  選択してください
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {fields.departmentId.errors && (
                <p className="text-red-500 text-xs mt-1">{fields.departmentId.errors[0]}</p>
              )}
            </div>

            {/* 見積日（変更で税率をライブ解決） */}
            <div>
              <label htmlFor="estimateDate" className="block text-gray-700 text-sm font-bold mb-2">
                見積日
              </label>
              <input
                type="date"
                id="estimateDate"
                name={fields.estimateDate.name}
                value={estimateDate}
                onChange={(e) => handleEstimateDateChange(e.target.value)}
                disabled={isPending}
                className={inputClassDisabled}
              />
              {fields.estimateDate.errors && (
                <p className="text-red-500 text-xs mt-1">{fields.estimateDate.errors[0]}</p>
              )}
            </div>

            {/* 締切日 */}
            <div>
              <label
                htmlFor={fields.deadline.id}
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                締切日
              </label>
              <input
                {...getInputProps(fields.deadline, { type: "date" })}
                defaultValue={defaultDeadline}
                disabled={isPending}
                className={inputClassDisabled}
              />
              {fields.deadline.errors && (
                <p className="text-red-500 text-xs mt-1">{fields.deadline.errors[0]}</p>
              )}
            </div>

            {/* 消費税率（read-only・見積年月日からライブ導出） */}
            <div>
              <span className="block text-gray-700 text-sm font-bold mb-2">消費税率</span>
              <p className="text-gray-900 py-2">
                {taxRate != null ? formatTaxRatePercent(taxRate) : "未設定"}
              </p>
              <p className="text-gray-600 text-xs mt-1">税率は見積年月日から自動決定されます</p>
            </div>

            {/* 税端数区分（プレビューに効くため controlled） */}
            <div>
              <label
                htmlFor="taxRoundingType"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                税端数区分
              </label>
              <select
                id="taxRoundingType"
                name={fields.taxRoundingType.name}
                value={taxRoundingType}
                onChange={(e) => setTaxRoundingType(e.target.value)}
                disabled={isPending}
                className={inputClassDisabled}
              >
                {Object.entries(TAX_ROUNDING_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {fields.taxRoundingType.errors && (
                <p className="text-red-500 text-xs mt-1">{fields.taxRoundingType.errors[0]}</p>
              )}
            </div>
          </div>
        </section>

        {/* 修理情報（REPAIR） */}
        {isRepair && (
          <RepairDetailFields
            targetProductIdName={fields.repairTargetProductId.name}
            targetProductId={targetProduct.id}
            targetProductLabel={targetProductLabel}
            onSelectProduct={() => setProductModalOpen(true)}
            scheduledRepairDateField={fields.repairScheduledRepairDate}
            faultDescriptionField={fields.repairFaultDescription}
            disabled={isPending}
          />
        )}

        {/* 事後修理情報（AFTER_REPAIR） */}
        {isAfterRepair && (
          <AfterRepairDetailFields
            targetProductIdName={fields.afterRepairTargetProductId.name}
            targetProductId={targetProduct.id}
            targetProductLabel={targetProductLabel}
            onSelectProduct={() => setProductModalOpen(true)}
            actualRepairDateField={fields.afterRepairActualRepairDate}
            emergencyReasonField={fields.afterRepairEmergencyReason}
            faultDescriptionField={fields.afterRepairFaultDescription}
            disabled={isPending}
          />
        )}

        {/* 初期バリエーション（1件・提出区分＋明細） */}
        <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-500">バリエーション</h2>
          <SubmissionTypeField field={fields.submissionType} mode="select" disabled={isPending} />
          <VariationLineEditor
            editor={editor}
            nodesField={fields.nodes}
            overallDiscountField={fields.overallDiscount}
            customerMemoField={fields.customerMemo}
            internalMemoField={fields.internalMemo}
            isPending={isPending}
          />
        </section>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "作成中..." : "作成"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/estimates")}
            disabled={isPending}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:cursor-not-allowed"
          >
            キャンセル
          </button>
        </div>
      </form>

      {/* FK 選択モーダル（単一選択） */}
      <SelectionModal<CompanyRow>
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        title="得意先を選択"
        searchFields={companySearchFields}
        searchAction={searchCustomersForSelection}
        columns={companySelectionColumns}
        onConfirm={handleCustomerSelect}
        getRowId={(row) => row.id}
        emptyMessage="該当する得意先が見つかりません"
      />
      <SelectionModal<CompanyRow>
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        title="納品先を選択"
        searchFields={companySearchFields}
        searchAction={searchDeliveryLocationsForSelection.bind(null, customer.id)}
        columns={companySelectionColumns}
        onConfirm={handleDeliverySelect}
        getRowId={(row) => row.id}
        emptyMessage="該当する納品先が見つかりません"
      />
      <SelectionModal<ProductSelectionRow>
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title="修理対象機器を選択"
        searchFields={productSearchFields}
        searchAction={searchProductsForSelection}
        columns={productSelectionColumns}
        onConfirm={handleProductSelect}
        getRowId={(row) => row.id}
        emptyMessage="該当する商品が見つかりません"
      />

      <VariationLineEditorOverlays editor={editor} />
    </>
  );
}
