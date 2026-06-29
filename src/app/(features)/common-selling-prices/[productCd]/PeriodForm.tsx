"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useEffect } from "react";
import { z } from "zod";
import { useServerForm } from "@/app/_hooks/useServerForm";
import type { CommonSellingPriceEditPeriodDTO } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceEditDTO";
import { formatYenFromDecimal } from "../_components/formatYen";
import { addPeriodAction, endDatePeriodAction, updateFuturePeriodAction } from "./actions";
import { addPeriodSchema, endDatePeriodSchema, updateFuturePeriodSchema } from "./schema";

/** 登録（新規追加）・将来行の全項目編集・適用終了 を1つのフォームで切り替える（決定3）。 */
export type PeriodFormMode = "new" | "edit" | "endDate";

/**
 * fields の型付け専用スキーマ（全モードのフィールドを網羅）。
 * 実行時の検証には使わない（検証はモード別スキーマ）。conform の `fields` 型を
 * モードに依らず安定させ、`fields.startDate` 等へ型安全にアクセスするためだけに用いる。
 * 値としては参照しない（型のみ）ため `_` プレフィックスで no-unused-vars を回避する。
 */
const _periodFormFieldsSchema = z.object({
  version: z.coerce.number(),
  periodId: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  price: z.coerce.number(),
});

type Props = {
  /** コマンド宛先キー（編集読みモデルが返す productId を bind）。 */
  productId: string;
  /** route／revalidate 用キー（編集読みモデルが返す productCode を bind）。 */
  productCode: string;
  /** 集約ルートの楽観ロックversion（hidden で往復）。未設定商品（新規登録モード）では null。 */
  version: number | null;
  mode: PeriodFormMode;
  /** edit / endDate で対象行。new では未指定。 */
  period?: CommonSellingPriceEditPeriodDTO;
  /** 成功時（パネルを閉じる）。 */
  onSuccess: () => void;
  /** キャンセル時（パネルを閉じる）。 */
  onCancel: () => void;
};

const SUBMIT_LABEL: Record<PeriodFormMode, { idle: string; busy: string }> = {
  new: { idle: "登録", busy: "登録中..." },
  edit: { idle: "更新", busy: "更新中..." },
  endDate: { idle: "適用終了", busy: "処理中..." },
};

/** モード別に送信先Action（productId・productCode を bind）と実行時スキーマを選ぶ。 */
function pickRuntime(mode: PeriodFormMode, productId: string, productCode: string) {
  switch (mode) {
    case "new":
      return {
        action: addPeriodAction.bind(null, productId, productCode),
        schema: addPeriodSchema,
      };
    case "edit":
      return {
        action: updateFuturePeriodAction.bind(null, productId, productCode),
        schema: updateFuturePeriodSchema,
      };
    case "endDate":
      return {
        action: endDatePeriodAction.bind(null, productId, productCode),
        schema: endDatePeriodSchema,
      };
  }
}

export function PeriodForm({
  productId,
  productCode,
  version,
  mode,
  period,
  onSuccess,
  onCancel,
}: Props) {
  const runtime = pickRuntime(mode, productId, productCode);

  const defaultValue = {
    version: version != null ? String(version) : undefined,
    periodId: period?.periodId,
    startDate: period?.start,
    endDate: period?.end ?? undefined,
    // 単価は10進文字列で運ぶ。整数入力欄の既定値は整数部のみを渡す（float を経由しない）。
    price: period != null ? period.sellingPrice.split(".")[0] : undefined,
  };

  const { form, fields, isPending } = useServerForm({
    action: runtime.action,
    // 実行時はモード別スキーマ（安全＝ロック項目は契約に無い）。型は網羅スキーマで付ける。
    schema: runtime.schema as unknown as typeof _periodFormFieldsSchema,
    defaultValue,
  });

  // 成功時（redirectせず留まる設計・決定8）にパネルを閉じる。revalidate済みでRSCは最新。
  useEffect(() => {
    if (form.status === "success") onSuccess();
  }, [form.status, onSuccess]);

  const labels = SUBMIT_LABEL[mode];
  const showFullFields = mode === "new" || mode === "edit";

  return (
    <div className="bg-white border rounded px-6 pt-5 pb-6 mt-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-700">
        {mode === "new" && "適用期間の登録"}
        {mode === "edit" && "適用期間の編集"}
        {mode === "endDate" && "適用終了（終了日の設定）"}
      </h3>

      {form.errors && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          {form.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <form {...getFormProps(form)} noValidate className="space-y-4">
        {/* 未設定商品の初回登録（version=null）では version を送らず BE に新規作成を選ばせる（#473）。 */}
        {version != null && (
          <input type="hidden" name={fields.version.name} value={String(version)} />
        )}
        {(mode === "edit" || mode === "endDate") && period != null && (
          <input type="hidden" name={fields.periodId.name} value={period.periodId} />
        )}

        {/* 適用終了モードは開始日・単価を読み取り専用表示（ロック項目＝入力契約に含めない） */}
        {mode === "endDate" && period != null && (
          <dl className="grid grid-cols-2 gap-4 bg-gray-50 rounded p-4">
            <div>
              <dt className="text-sm font-bold text-gray-700">適用開始日</dt>
              <dd className="mt-1 tabular-nums text-gray-900">{period.start}</dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-gray-700">共通販売単価</dt>
              <dd className="mt-1 tabular-nums text-gray-900">
                {formatYenFromDecimal(period.sellingPrice)}
              </dd>
            </div>
          </dl>
        )}

        {showFullFields && (
          <div>
            <label
              htmlFor={fields.startDate.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              適用開始日
            </label>
            <input
              {...getInputProps(fields.startDate, { type: "date" })}
              disabled={isPending}
              className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            />
            {fields.startDate.errors && (
              <p className="text-red-500 text-xs mt-1" id={fields.startDate.errorId}>
                {fields.startDate.errors[0]}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor={fields.endDate.id} className="block text-gray-700 text-sm font-bold mb-2">
            適用終了日
          </label>
          <input
            {...getInputProps(fields.endDate, { type: "date" })}
            disabled={isPending}
            className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.endDate.errors ? (
            <p className="text-red-500 text-xs mt-1" id={fields.endDate.errorId}>
              {fields.endDate.errors[0]}
            </p>
          ) : (
            <p className="text-gray-600 text-xs mt-1">
              {mode === "endDate"
                ? "この日から適用しなくなります（終了日は含みません）。"
                : "未入力なら無期限。終了日はその日を含みません。"}
            </p>
          )}
        </div>

        {showFullFields && (
          <div>
            <label htmlFor={fields.price.id} className="block text-gray-700 text-sm font-bold mb-2">
              共通販売単価（円）
            </label>
            <input
              {...getInputProps(fields.price, { type: "number" })}
              min={0}
              step={1}
              disabled={isPending}
              className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            />
            {fields.price.errors ? (
              <p className="text-red-500 text-xs mt-1" id={fields.price.errorId}>
                {fields.price.errors[0]}
              </p>
            ) : (
              <p className="text-gray-600 text-xs mt-1">0円以上の整数。</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? labels.busy : labels.idle}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
