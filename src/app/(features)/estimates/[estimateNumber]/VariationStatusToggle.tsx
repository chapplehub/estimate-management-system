"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { activateVariation, deactivateVariation } from "./actions";
import { variationStatusSchema } from "./variationStatusSchema";

type Props = {
  estimateNumber: string;
  variationId: string;
  /** 現在のバリエーション状態（ACTIVE のとき無効化ボタン、INACTIVE のとき有効化ボタンを出す）。 */
  isActive: boolean;
  /** 集約ルートの楽観ロックトークン（ADR-0039）。hidden で往復する。 */
  version: number;
};

/**
 * バリエーション有効化/無効化トグル（S7 / C5・操作行⑤の自己完結部品）。
 *
 * ADR-0018 でコマンドは Activate/Deactivate に分離されているため、現在状態の逆操作にあたる
 * Server Action を `isActive` で選んで 1 つの form として出す（ProductStatusForms 踏襲）。状態
 * 変更は可逆かつ金額に影響しないため確認ダイアログは置かない（Product 前例どおり）。全バリに
 * 無条件で表示し、進行ロック（申請以降は無効化不可・ADR-0061）はコマンド側の拡張点に閉じる。
 * version・variationId は hidden で往復し、競合・業務エラーは conform の form.errors で提示する。
 */
export function VariationStatusToggle({ estimateNumber, variationId, isActive, version }: Props) {
  const action = (isActive ? deactivateVariation : activateVariation).bind(null, estimateNumber);
  const { form, fields, isPending } = useServerForm({
    action,
    schema: variationStatusSchema,
    defaultValue: {
      version: String(version),
      variationId,
    },
  });

  return (
    <div>
      {form.errors && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-2 text-sm"
          role="alert"
        >
          {form.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <form {...getFormProps(form)} noValidate>
        <input {...getInputProps(fields.version, { type: "hidden" })} />
        <input type="hidden" name={fields.variationId.name} value={variationId} />
        <button
          type="submit"
          disabled={isPending}
          className={[
            "text-white text-sm font-bold py-1 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed",
            isActive ? "bg-yellow-500 hover:bg-yellow-700" : "bg-green-500 hover:bg-green-700",
          ].join(" ")}
        >
          {isActive ? (isPending ? "無効化中..." : "無効化") : isPending ? "有効化中..." : "有効化"}
        </button>
      </form>
    </div>
  );
}
