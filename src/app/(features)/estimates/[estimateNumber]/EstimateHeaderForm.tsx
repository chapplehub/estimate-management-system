"use client";

import { getFormProps, getInputProps, getSelectProps, getTextareaProps } from "@conform-to/react";
import { useState } from "react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { SelectionModal } from "@/app/_components/shared/SelectionModal";
import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { toDateInputValue } from "../_shared/date";
import { TAX_ROUNDING_TYPE_LABELS } from "../_shared/labels";
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
import { updateEstimateHeader } from "./actions";
import { updateEstimateHeaderSchema } from "./schema";

/** 編集に必要な見積ヘッダーのデータ（EstimateDetailDTO の部分集合）。 */
export type EstimateHeaderData = {
  estimateNumber: string;
  estimateType: string;
  version: number;
  estimateDate: Date;
  deadline: Date;
  customerId: string;
  customerCode: string;
  customerName: string;
  deliveryLocationId: string;
  deliveryLocationCode: string;
  deliveryLocationName: string;
  departmentId: string;
  departmentName: string;
  creatorName: string;
  creatorCode: string;
  taxRate: number;
  taxRoundingType: string;
  hasRevision: boolean;
  repairDetail: {
    targetProductId: string;
    targetProductCode: string;
    targetProductName: string;
    faultDescription: string;
    scheduledRepairDate: Date;
  } | null;
  afterRepairDetail: {
    targetProductId: string;
    targetProductCode: string;
    targetProductName: string;
    faultDescription: string;
    actualRepairDate: Date;
    emergencyReason: string;
  } | null;
};

type DepartmentOption = { id: string; name: string };

type Props = {
  estimate: EstimateHeaderData;
  departments: DepartmentOption[];
  onCancel: () => void;
};

const companySearchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "名称", placeholder: "部分一致" },
];

const productSearchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "商品コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "商品名", placeholder: "部分一致" },
];

const inputClass =
  "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100";

export function EstimateHeaderForm({ estimate, departments, onCancel }: Props) {
  // 改訂が存在すると見積年月日・得意先・納品先・税端数は変更不可（§7.2）。最終強制は
  // ドメイン（assertHeaderMutable・ADR-0049）だが、UX として disabled 表示する二重防御。
  const locked = estimate.hasRevision;

  const action = updateEstimateHeader.bind(null, estimate.estimateNumber);
  const { form, fields, isPending } = useServerForm({
    action,
    schema: updateEstimateHeaderSchema,
    defaultValue: {
      version: String(estimate.version),
      deadline: toDateInputValue(estimate.deadline),
      departmentId: estimate.departmentId,
      repairFaultDescription: estimate.repairDetail?.faultDescription ?? "",
      repairScheduledRepairDate: estimate.repairDetail
        ? toDateInputValue(estimate.repairDetail.scheduledRepairDate)
        : "",
      afterRepairFaultDescription: estimate.afterRepairDetail?.faultDescription ?? "",
      afterRepairActualRepairDate: estimate.afterRepairDetail
        ? toDateInputValue(estimate.afterRepairDetail.actualRepairDate)
        : "",
      afterRepairEmergencyReason: estimate.afterRepairDetail?.emergencyReason ?? "",
    },
  });

  // モーダル駆動の FK とロック対象はローカル state + hidden input で持つ（disabled でも送信するため）。
  const [estimateDate, setEstimateDate] = useState(toDateInputValue(estimate.estimateDate));
  const [taxRoundingType, setTaxRoundingType] = useState(estimate.taxRoundingType);
  const [customer, setCustomer] = useState({
    id: estimate.customerId,
    code: estimate.customerCode,
    name: estimate.customerName,
  });
  const [deliveryLocation, setDeliveryLocation] = useState({
    id: estimate.deliveryLocationId,
    code: estimate.deliveryLocationCode,
    name: estimate.deliveryLocationName,
  });
  const subtype = estimate.repairDetail ?? estimate.afterRepairDetail;
  const [targetProduct, setTargetProduct] = useState({
    id: subtype?.targetProductId ?? "",
    code: subtype?.targetProductCode ?? "",
    name: subtype?.targetProductName ?? "",
  });

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);

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

  const isRepair = estimate.estimateType === "REPAIR";
  const isAfterRepair = estimate.estimateType === "AFTER_REPAIR";

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
        {/* 楽観ロックトークン（ADR-0039） */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />
        {/* モーダル駆動 FK・ロック対象は state を hidden で送る（disabled でも送信される） */}
        <input type="hidden" name={fields.customerId.name} value={customer.id} />
        <input type="hidden" name={fields.deliveryLocationId.name} value={deliveryLocation.id} />
        <input type="hidden" name={fields.estimateDate.name} value={estimateDate} />
        <input type="hidden" name={fields.taxRoundingType.name} value={taxRoundingType} />

        <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-500">基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 得意先（SelectionModal・改訂時ロック） */}
            <div>
              <span className="block text-gray-700 text-sm font-bold mb-2">得意先</span>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-gray-900">
                  {customer.id ? `${customer.name}（${customer.code}）` : "未選択"}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(true)}
                  disabled={locked || isPending}
                  aria-label="得意先を選択"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-bold py-1 px-3 rounded disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  選択
                </button>
              </div>
              {fields.customerId.errors && (
                <p className="text-red-500 text-xs mt-1">{fields.customerId.errors[0]}</p>
              )}
            </div>

            {/* 納品先（SelectionModal・選択中得意先で絞り込み・改訂時ロック） */}
            <div>
              <span className="block text-gray-700 text-sm font-bold mb-2">納品先</span>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-gray-900">
                  {deliveryLocation.id
                    ? `${deliveryLocation.name}（${deliveryLocation.code}）`
                    : "未選択"}
                </span>
                <button
                  type="button"
                  onClick={() => setDeliveryModalOpen(true)}
                  disabled={locked || isPending || !customer.id}
                  aria-label="納品先を選択"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-bold py-1 px-3 rounded disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  選択
                </button>
              </div>
              {fields.deliveryLocationId.errors && (
                <p className="text-red-500 text-xs mt-1">{fields.deliveryLocationId.errors[0]}</p>
              )}
            </div>

            {/* 部署（select・改訂後も変更可） */}
            <div>
              <label
                htmlFor={fields.departmentId.id}
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                部署
              </label>
              <select
                {...getSelectProps(fields.departmentId)}
                disabled={isPending}
                className={inputClass}
              >
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

            {/* 作成者（read-only） */}
            <div>
              <span className="block text-gray-700 text-sm font-bold mb-2">作成者</span>
              <p className="text-gray-900 py-2">
                {estimate.creatorName}（{estimate.creatorCode}）
              </p>
            </div>

            {/* 見積日（改訂時ロック） */}
            <div>
              <label htmlFor="estimateDate" className="block text-gray-700 text-sm font-bold mb-2">
                見積日
              </label>
              <input
                type="date"
                id="estimateDate"
                value={estimateDate}
                onChange={(e) => setEstimateDate(e.target.value)}
                disabled={locked || isPending}
                className={inputClass}
              />
              {fields.estimateDate.errors && (
                <p className="text-red-500 text-xs mt-1">{fields.estimateDate.errors[0]}</p>
              )}
            </div>

            {/* 締切日（改訂後も変更可） */}
            <div>
              <label
                htmlFor={fields.deadline.id}
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                締切日
              </label>
              <input
                {...getInputProps(fields.deadline, { type: "date" })}
                disabled={isPending}
                className={inputClass}
              />
              {fields.deadline.errors && (
                <p className="text-red-500 text-xs mt-1">{fields.deadline.errors[0]}</p>
              )}
            </div>

            {/* 消費税率（常に read-only・自由入力不可） */}
            <div>
              <span className="block text-gray-700 text-sm font-bold mb-2">消費税率</span>
              <p className="text-gray-900 py-2">{Math.round(estimate.taxRate * 100)}%</p>
              <p className="text-gray-600 text-xs mt-1">税率は見積年月日から自動決定されます</p>
            </div>

            {/* 税端数区分（改訂時ロック） */}
            <div>
              <label
                htmlFor="taxRoundingType"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                税端数区分
              </label>
              <select
                id="taxRoundingType"
                value={taxRoundingType}
                onChange={(e) => setTaxRoundingType(e.target.value)}
                disabled={locked || isPending}
                className={inputClass}
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

        {/* 修理情報（REPAIR・改訂後も編集可） */}
        {isRepair && (
          <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-500">修理情報</h2>
            <input
              type="hidden"
              name={fields.repairTargetProductId.name}
              value={targetProduct.id}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="block text-gray-700 text-sm font-bold mb-2">修理対象機器</span>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-gray-900">
                    {targetProduct.id ? `${targetProduct.name}（${targetProduct.code}）` : "未選択"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setProductModalOpen(true)}
                    disabled={isPending}
                    aria-label="修理対象機器を選択"
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-bold py-1 px-3 rounded disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    選択
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor={fields.repairScheduledRepairDate.id}
                  className="block text-gray-700 text-sm font-bold mb-2"
                >
                  修理予定日
                </label>
                <input
                  {...getInputProps(fields.repairScheduledRepairDate, { type: "date" })}
                  disabled={isPending}
                  className={inputClass}
                />
                {fields.repairScheduledRepairDate.errors && (
                  <p className="text-red-500 text-xs mt-1">
                    {fields.repairScheduledRepairDate.errors[0]}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor={fields.repairFaultDescription.id}
                  className="block text-gray-700 text-sm font-bold mb-2"
                >
                  故障内容
                </label>
                <textarea
                  {...getTextareaProps(fields.repairFaultDescription)}
                  disabled={isPending}
                  rows={3}
                  className={inputClass}
                />
                {fields.repairFaultDescription.errors && (
                  <p className="text-red-500 text-xs mt-1">
                    {fields.repairFaultDescription.errors[0]}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 事後修理情報（AFTER_REPAIR・改訂後も編集可） */}
        {isAfterRepair && (
          <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-500">事後修理情報</h2>
            <input
              type="hidden"
              name={fields.afterRepairTargetProductId.name}
              value={targetProduct.id}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="block text-gray-700 text-sm font-bold mb-2">修理対象機器</span>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-gray-900">
                    {targetProduct.id ? `${targetProduct.name}（${targetProduct.code}）` : "未選択"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setProductModalOpen(true)}
                    disabled={isPending}
                    aria-label="修理対象機器を選択"
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-bold py-1 px-3 rounded disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    選択
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor={fields.afterRepairActualRepairDate.id}
                  className="block text-gray-700 text-sm font-bold mb-2"
                >
                  修理実施日
                </label>
                <input
                  {...getInputProps(fields.afterRepairActualRepairDate, { type: "date" })}
                  disabled={isPending}
                  className={inputClass}
                />
                {fields.afterRepairActualRepairDate.errors && (
                  <p className="text-red-500 text-xs mt-1">
                    {fields.afterRepairActualRepairDate.errors[0]}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor={fields.afterRepairEmergencyReason.id}
                  className="block text-gray-700 text-sm font-bold mb-2"
                >
                  緊急対応理由
                </label>
                <textarea
                  {...getTextareaProps(fields.afterRepairEmergencyReason)}
                  disabled={isPending}
                  rows={2}
                  className={inputClass}
                />
                {fields.afterRepairEmergencyReason.errors && (
                  <p className="text-red-500 text-xs mt-1">
                    {fields.afterRepairEmergencyReason.errors[0]}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor={fields.afterRepairFaultDescription.id}
                  className="block text-gray-700 text-sm font-bold mb-2"
                >
                  故障内容
                </label>
                <textarea
                  {...getTextareaProps(fields.afterRepairFaultDescription)}
                  disabled={isPending}
                  rows={3}
                  className={inputClass}
                />
                {fields.afterRepairFaultDescription.errors && (
                  <p className="text-red-500 text-xs mt-1">
                    {fields.afterRepairFaultDescription.errors[0]}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            onClick={onCancel}
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
    </>
  );
}
