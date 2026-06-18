"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/shadcnui/dialog";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { reviseForCustomer } from "./actions";
import { reviseForCustomerSchema } from "./reviseForCustomerSchema";

type Props = {
  /** 見積番号（Server Action の束縛・成功時 redirect の戻り先に使う）。 */
  estimateNumber: string;
  /** 親集約の楽観ロックトークン（ADR-0039）。hidden で往復する。 */
  version: number;
  /** 改訂元（納品先宛・ACTIVE）のバリエーション ID。hidden で往復する。 */
  sourceVariationId: string;
  /** 改訂元の案番号（確認文の表示用）。 */
  sourceVariationNumber: number;
  /**
   * この見積に既に改訂系譜が存在するか（top-level・ADR-0049）。初回改訂（false）のときのみ
   * ヘッダーロックの告知を出す（2 回目以降は既にロック済みで冗長なため）。
   */
  hasRevision: boolean;
};

/**
 * 得意先改訂の確認モーダル（C7）。
 *
 * 操作行の「得意先改訂」ボタン（トリガー）とモーダルを内包する自己完結コンポーネント。改訂先の
 * 内容はドメインが改訂元から全複写で決定するため利用者の入力面は無く、UI は「ボタン → 確認 →
 * 純粋コマンド送信」に徹する（hidden は version と sourceVariationId のみ）。確認に `dialog.tsx`
 * モーダルを使うのは、不可逆な結果（改訂系譜生成・改訂元凍結・初回はヘッダーロック）の説明責任と、
 * 税率不一致（§8.7）・楽観ロック競合（ADR-0039）の formErrors をモーダル内インラインに置くため
 * （window.confirm 経路だとエラーの描画先が宙に浮く・判断B）。開閉 state は PanelMode（body の
 * 閲覧／編集／新規／複製）と直交した別 state でこのコンポーネント内に閉じる。
 */
export function ReviseForCustomerDialog({
  estimateNumber,
  version,
  sourceVariationId,
  sourceVariationNumber,
  hasRevision,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-orange-500 hover:bg-orange-700 text-white text-sm font-bold py-1 px-4 rounded focus:outline-none focus:shadow-outline"
      >
        得意先改訂
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>得意先改訂</DialogTitle>
            <DialogDescription>
              第{sourceVariationNumber}
              案（納品先宛）を改訂元として、得意先宛の改訂先バリエーションを
              この見積内に作成します。改訂先の内容は改訂元から引き継がれます。
            </DialogDescription>
          </DialogHeader>

          {open && (
            <ReviseForm
              estimateNumber={estimateNumber}
              version={version}
              sourceVariationId={sourceVariationId}
              sourceVariationNumber={sourceVariationNumber}
              hasRevision={hasRevision}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * モーダル内の改訂フォーム本体。`open` 時のみマウントして conform の状態を開閉ごとにリセットする。
 */
function ReviseForm({
  estimateNumber,
  version,
  sourceVariationId,
  sourceVariationNumber,
  hasRevision,
  onCancel,
}: Props & { onCancel: () => void }) {
  const action = reviseForCustomer.bind(null, estimateNumber);
  const { form, fields, isPending } = useServerForm({
    action,
    schema: reviseForCustomerSchema,
    defaultValue: {
      version: String(version),
      sourceVariationId,
    },
  });

  return (
    <form {...getFormProps(form)} noValidate>
      <input {...getInputProps(fields.version, { type: "hidden" })} />
      <input {...getInputProps(fields.sourceVariationId, { type: "hidden" })} />

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

      {/* 不可逆な結果の告知。凍結は常時、ヘッダーロックは初回改訂のときのみ。 */}
      <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm px-3 py-2 rounded mb-4 space-y-2">
        <p>
          改訂すると、改訂元の第{sourceVariationNumber}
          案はメモ以外を編集できなくなります（凍結）。
        </p>
        {!hasRevision && (
          <p>
            また、この見積で最初の改訂のため、以後この見積の見積年月日・税率・税端数・得意先・納品先が
            変更できなくなります。
          </p>
        )}
      </div>

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
          {isPending ? "改訂中..." : "得意先改訂する"}
        </button>
      </div>
    </form>
  );
}
