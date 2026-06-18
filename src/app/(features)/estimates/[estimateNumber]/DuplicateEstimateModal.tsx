"use client";

import { getFormProps, getSelectProps } from "@conform-to/react";
import { useMemo, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/shadcnui/dialog";
import { useServerForm } from "@/app/_hooks/useServerForm";
import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { inputClassDisabled } from "../_shared/formStyles";
import { SUBMISSION_TYPE_LABELS, VARIATION_STATUS_LABELS } from "../_shared/labels";
import { resolveEffectiveTaxRate } from "../_shared/tax-rate-actions";
import { formatTaxRatePercent } from "../_shared/tax-rate-format";
import { duplicateEstimate } from "./actions";
import { duplicateEstimateSchema } from "./duplicateSchema";
import { isVariationDuplicatable } from "./variationEditable";

type DepartmentOption = { id: string; name: string };

type Props = {
  /** 複製元の見積番号（Server Action の束縛・キャンセル戻り先に使う）。 */
  sourceEstimateNumber: string;
  /** 複製元のバリエーション（variationNumber 昇順）。適格性は isVariationDuplicatable で判定する。 */
  variations: VariationDTO[];
  /** 複製元の部署 ID（既定選択。複製先も同部署が自然なため）。 */
  sourceDepartmentId: string;
  departments: DepartmentOption[];
  /** 既定の見積年月日 "yyyy-mm-dd"（今日・JST）。 */
  defaultEstimateDate: string;
  /** 既定の締切日 "yyyy-mm-dd"。 */
  defaultDeadline: string;
  /** 既定見積年月日に対する解決済み有効税率（マスタ該当なしは null）。 */
  initialTaxRate: number | null;
};

/**
 * 見積複製モーダル（C6・ADR-0057）。
 *
 * 複製元詳細画面のヘッダー操作エリアから開く自己完結コンポーネント。トリガーボタンとモーダルを
 * 内包し、複製元から継承する項目（見積区分・得意先・納品先・税端数区分・提出区分）は入力させず、
 * 利用者入力面を「複製するバリエーションの選択（≥1）＋見積日・締切日・部署」に絞る（§5.3）。
 *
 * - バリ選択は適格性（isVariationDuplicatable＝改訂明細を含まない）で出し分け、不適格バリは
 *   表示するがチェック不可（透明性優先）。適格バリ0件なら複製ボタン自体を無効化する。
 * - 選択は複製元の並び順（variationNumber 昇順）の DOM で描画し、ブラウザが checked のみを
 *   FormData へ同名収集するため送出順＝複製元順になる（複製先で連番に振り直す）。
 * - 税率はフォーム入力でなく見積年月日からライブ解決し read-only 表示（submit 時 §8.7 再確定・
 *   checkTaxRateThenDuplicate が所有・ADR-0056）。単価クリアは常設注記で明示する。
 * - 成功時は Server Action が新採番の見積詳細へ redirect するため、ここでは閉じ処理を持たない。
 */
export function DuplicateEstimateModal({
  sourceEstimateNumber,
  variations,
  sourceDepartmentId,
  departments,
  defaultEstimateDate,
  defaultDeadline,
  initialTaxRate,
}: Props) {
  const [open, setOpen] = useState(false);

  // 適格バリ（改訂明細を含まない）が1件も無ければ複製不可。理由をツールチップで示す。
  const eligibleCount = useMemo(
    () => variations.filter(isVariationDuplicatable).length,
    [variations]
  );
  const canDuplicate = eligibleCount > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canDuplicate}
        title={
          canDuplicate
            ? undefined
            : "複製できるバリエーションがありません（改訂明細を含むバリエーションは複製元にできません）"
        }
        className="bg-white hover:bg-gray-100 text-gray-700 font-bold py-2 px-4 rounded border border-gray-300 focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed"
      >
        見積複製
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>見積複製</DialogTitle>
            <DialogDescription>
              複製するバリエーションを選び、見積日・締切日・部署を指定してください。得意先・納品先・
              見積区分・税端数区分・提出区分は複製元から引き継がれます。
            </DialogDescription>
          </DialogHeader>

          {open && (
            <DuplicateForm
              sourceEstimateNumber={sourceEstimateNumber}
              variations={variations}
              sourceDepartmentId={sourceDepartmentId}
              departments={departments}
              defaultEstimateDate={defaultEstimateDate}
              defaultDeadline={defaultDeadline}
              initialTaxRate={initialTaxRate}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * モーダル内の複製フォーム本体。`open` 時のみマウントして conform の状態を開閉ごとにリセットする。
 */
function DuplicateForm({
  sourceEstimateNumber,
  variations,
  sourceDepartmentId,
  departments,
  defaultEstimateDate,
  defaultDeadline,
  initialTaxRate,
  onCancel,
}: Props & { onCancel: () => void }) {
  const action = duplicateEstimate.bind(null, sourceEstimateNumber);
  const { form, fields, isPending } = useServerForm({
    action,
    schema: duplicateEstimateSchema,
  });

  const [estimateDate, setEstimateDate] = useState(defaultEstimateDate);
  const [taxRate, setTaxRate] = useState<number | null>(initialTaxRate);
  const [, startTaxResolve] = useTransition();

  // 見積年月日の変更に追従して有効税率をライブ解決する（作成画面と同じ findEffectiveAt・§A.1）。
  const handleEstimateDateChange = (value: string) => {
    setEstimateDate(value);
    startTaxResolve(async () => {
      setTaxRate(await resolveEffectiveTaxRate(value));
    });
  };

  return (
    <form {...getFormProps(form)} noValidate>
      {form.errors && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm"
          role="alert"
        >
          {form.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {/* 複製するバリエーション（≥1・複製元の並び順）。不適格は表示＋チェック不可。 */}
      <fieldset className="mb-4">
        <legend className="block text-gray-700 text-sm font-bold mb-2">
          複製するバリエーション
        </legend>
        <ul className="space-y-2">
          {variations.map((v) => {
            const eligible = isVariationDuplicatable(v);
            return (
              <li key={v.variationId}>
                <label
                  className={`flex items-center gap-2 ${
                    eligible ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    name={fields.selectedVariationIds.name}
                    value={v.variationId}
                    disabled={!eligible || isPending}
                  />
                  <span>
                    第{v.variationNumber}案（
                    {SUBMISSION_TYPE_LABELS[v.submissionType] ?? v.submissionType}・
                    {VARIATION_STATUS_LABELS[v.status] ?? v.status}）
                  </span>
                  {!eligible && (
                    <span className="text-xs text-gray-400">
                      改訂明細を含むため複製元にできません
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
        {fields.selectedVariationIds.errors && (
          <p className="text-red-500 text-xs mt-1">{fields.selectedVariationIds.errors[0]}</p>
        )}
      </fieldset>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* 見積日（変更で税率をライブ解決） */}
        <div>
          <label
            htmlFor="duplicateEstimateDate"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            見積日
          </label>
          <input
            type="date"
            id="duplicateEstimateDate"
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
          <label htmlFor="duplicateDeadline" className="block text-gray-700 text-sm font-bold mb-2">
            締切日
          </label>
          <input
            type="date"
            id="duplicateDeadline"
            name={fields.deadline.name}
            defaultValue={defaultDeadline}
            disabled={isPending}
            className={inputClassDisabled}
          />
          {fields.deadline.errors && (
            <p className="text-red-500 text-xs mt-1">{fields.deadline.errors[0]}</p>
          )}
        </div>

        {/* 部署（複製元を既定選択） */}
        <div>
          <label
            htmlFor={fields.departmentId.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            部署
          </label>
          <select
            {...getSelectProps(fields.departmentId)}
            defaultValue={sourceDepartmentId}
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

        {/* 消費税率（read-only・見積年月日からライブ導出） */}
        <div>
          <span className="block text-gray-700 text-sm font-bold mb-2">消費税率</span>
          <p className="text-gray-900 py-2">
            {taxRate != null ? formatTaxRatePercent(taxRate) : "未設定"}
          </p>
          <p className="text-gray-600 text-xs mt-1">税率は見積年月日から自動決定されます</p>
        </div>
      </div>

      {/* 単価クリアの常設注記（#334 §5 / ADR-0057）。 */}
      <p className="bg-amber-50 border border-amber-300 text-amber-800 text-sm px-3 py-2 rounded mb-4">
        複製先では見積単価がクリアされます。複製後に各バリエーションで再入力してください。
      </p>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:cursor-not-allowed"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isPending ? "複製中..." : "複製"}
        </button>
      </div>
    </form>
  );
}
