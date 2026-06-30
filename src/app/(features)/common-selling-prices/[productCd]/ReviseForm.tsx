"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useEffect } from "react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { formatYenFromDecimal } from "../_components/formatYen";
import { revisePeriodAction } from "./actions";
import { revisePeriodSchema } from "./schema";

type Props = {
  /** コマンド宛先キー（編集読みモデルが返す productId を bind）。 */
  productId: string;
  /** route／revalidate 用キー（編集読みモデルが返す productCode を bind）。 */
  productCode: string;
  /** 集約ルートの楽観ロックversion（hidden で往復）。 */
  version: number;
  /** 現在有効行の単価（10進文字列）。方向ラベルの算出と現単価表示に使う（表示専用・改竄面に載せない）。 */
  currentPrice: string;
  /** 成功時（パネルを閉じる）。 */
  onSuccess: () => void;
  /** キャンセル時（パネルを閉じる）。 */
  onCancel: () => void;
};

/** 入力中の新単価と現単価から改定方向を表示用に算出する（据え置きも許容＝拒否しない）。 */
function directionLabel(
  currentPrice: string,
  rawNewPrice: string | undefined
): { text: string; className: string } | null {
  if (rawNewPrice == null || rawNewPrice === "") return null;
  const next = Number(rawNewPrice);
  const current = Number(currentPrice);
  if (!Number.isFinite(next) || !Number.isFinite(current)) return null;
  if (next > current) return { text: "値上げ", className: "text-red-600" };
  if (next < current) return { text: "値下げ", className: "text-blue-600" };
  return { text: "据え置き", className: "text-gray-600" };
}

/**
 * 単価改定（ガイド付き・#474）専用フォーム。
 *
 * 「現在有効行の適用終了（終了日＝改定日）＋改定日開始の新規追加」を BE 単一コマンドが合成する操作の
 * 入力ガワ。改定固有の最小入力契約（改定日＋新単価。version は hidden）を PeriodForm に混ぜず独立させる
 * （現単価表示・方向ラベル・単一日付セマンティクスが汎用フォームと噛み合わないため）。現在有効行の特定は
 * サーバーが参照日で行うため periodId は送らない。方向ラベルは表示専用で、据え置き（新＝現）も許容する。
 */
export function ReviseForm({
  productId,
  productCode,
  version,
  currentPrice,
  onSuccess,
  onCancel,
}: Props) {
  const { form, fields, isPending } = useServerForm({
    action: revisePeriodAction.bind(null, productId, productCode),
    schema: revisePeriodSchema,
    defaultValue: { version: String(version), revisionDate: undefined, price: undefined },
  });

  // 成功時（redirectせず留まる設計）にパネルを閉じる。revalidate済みでRSCは最新。
  useEffect(() => {
    if (form.status === "success") onSuccess();
  }, [form.status, onSuccess]);

  const direction = directionLabel(currentPrice, fields.price.value);

  return (
    <div className="bg-white border rounded px-6 pt-5 pb-6 mt-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-700">
        単価改定（改定日から新単価へ切替）
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
        <input type="hidden" name={fields.version.name} value={String(version)} />

        {/* 現単価は読み取り専用表示（改定の起点。入力契約には含めない）。 */}
        <dl className="bg-gray-50 rounded p-4">
          <dt className="text-sm font-bold text-gray-700">現在の共通販売単価</dt>
          <dd className="mt-1 tabular-nums text-gray-900">{formatYenFromDecimal(currentPrice)}</dd>
        </dl>

        <div>
          <label
            htmlFor={fields.revisionDate.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            改定日
          </label>
          <input
            {...getInputProps(fields.revisionDate, { type: "date" })}
            disabled={isPending}
            className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.revisionDate.errors ? (
            <p className="text-red-500 text-xs mt-1" id={fields.revisionDate.errorId}>
              {fields.revisionDate.errors[0]}
            </p>
          ) : (
            <p className="text-gray-600 text-xs mt-1">
              この日から新単価を適用します（改定日は明日以降。当日は含みます）。
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fields.price.id} className="block text-gray-700 text-sm font-bold mb-2">
            改定後の共通販売単価（円）
          </label>
          <div className="flex items-center gap-3">
            <input
              {...getInputProps(fields.price, { type: "number" })}
              min={0}
              step={1}
              disabled={isPending}
              className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            />
            {direction && (
              <span className={`text-sm font-bold ${direction.className}`}>{direction.text}</span>
            )}
          </div>
          {fields.price.errors ? (
            <p className="text-red-500 text-xs mt-1" id={fields.price.errorId}>
              {fields.price.errors[0]}
            </p>
          ) : (
            <p className="text-gray-600 text-xs mt-1">0円以上の整数。</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "改定中..." : "改定する"}
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
