"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useState } from "react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { LineTable, type MemoPatch } from "./components/LineTable";
import { updateVariationMemos } from "./actions";
import { updateVariationMemosSchema } from "./variationMemoSchema";

type Props = {
  estimateNumber: string;
  /** 集約ルートの楽観ロックトークン（ADR-0039）。 */
  version: number;
  variation: VariationDTO;
  onCancel: () => void;
};

/** 明細メモの作業状態（itemId キー）。LineTable の編集と双方向。 */
type ItemMemoState = Record<string, { customerMemo: string; internalMemo: string }>;

/** 明細行（通常明細＋構成明細）を平坦化し itemId→メモ の初期状態を作る（セット群自身は対象外）。 */
function buildInitialItemMemos(variation: VariationDTO): ItemMemoState {
  const state: ItemMemoState = {};
  for (const node of variation.lines) {
    if (node.kind === "setGroup") {
      for (const c of node.components) {
        state[c.itemId] = { customerMemo: c.customerMemo, internalMemo: c.internalMemo };
      }
    } else {
      state[node.itemId] = { customerMemo: node.customerMemo, internalMemo: node.internalMemo };
    }
  }
  return state;
}

/**
 * 改訂元のメモのみ編集フォーム（C7・凍結貫通・ADR-0059）。
 *
 * 凍結された改訂元はメモ以外編集不可のため、明細・数量・価格は read-only の {@link LineTable} で
 * 見せ、メモだけを編集させる。明細メモは itemId キーの作業 state で controlled に持ち、submit 時に
 * 単一 hidden へ JSON 化して往復する（往復形状・ADR-0050）。LineTable は `line.customerMemo` を
 * 入力値に使う契約のため、DTO の lines に作業 state を写し込んだ派生配列を渡す（LineTable に
 * メモ専用 prop を増やさない）。バリ単位メモはスカラーゆえ conform 管理の textarea（uncontrolled）。
 * version・variationId は hidden で往復（ADR-0039）。成功時は Server Action が閲覧へ redirect する。
 */
export function VariationMemoEditForm({ estimateNumber, version, variation, onCancel }: Props) {
  const action = updateVariationMemos.bind(null, estimateNumber);
  const { form, fields, isPending } = useServerForm({
    action,
    schema: updateVariationMemosSchema,
    defaultValue: {
      version: String(version),
      variationId: variation.variationId,
      customerMemo: variation.customerMemo,
      internalMemo: variation.internalMemo,
    },
  });

  const [itemMemos, setItemMemos] = useState<ItemMemoState>(() => buildInitialItemMemos(variation));

  function patchItemMemo(itemId: string, patch: MemoPatch): void {
    setItemMemos((prev) => ({
      ...prev,
      [itemId]: {
        customerMemo: prev[itemId]?.customerMemo ?? "",
        internalMemo: prev[itemId]?.internalMemo ?? "",
        ...patch,
      },
    }));
  }

  // LineTable の入力値（line.customerMemo）に作業 state を写し込んだ派生 lines。
  const linesWithMemos = variation.lines.map((node) =>
    node.kind === "setGroup"
      ? {
          ...node,
          components: node.components.map((c) => ({
            ...c,
            customerMemo: itemMemos[c.itemId]?.customerMemo ?? c.customerMemo,
            internalMemo: itemMemos[c.itemId]?.internalMemo ?? c.internalMemo,
          })),
        }
      : {
          ...node,
          customerMemo: itemMemos[node.itemId]?.customerMemo ?? node.customerMemo,
          internalMemo: itemMemos[node.itemId]?.internalMemo ?? node.internalMemo,
        }
  );

  // hidden へ載せる明細メモ配列（itemId キーのフラット配列）。
  const itemMemosPayload = Object.entries(itemMemos).map(([itemId, m]) => ({
    itemId,
    customerMemo: m.customerMemo,
    internalMemo: m.internalMemo,
  }));

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

      <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2 rounded mb-4 text-sm">
        このバリエーションは得意先改訂の改訂元として凍結されています。メモのみ編集できます。
      </div>

      <form {...getFormProps(form)} noValidate>
        {/* 楽観ロックトークン・対象バリ。 */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />
        <input type="hidden" name={fields.variationId.name} value={variation.variationId} />
        {/* 明細メモ（作業 state を JSON 化して往復・ADR-0050）。 */}
        <input
          type="hidden"
          name={fields.itemMemos.name}
          value={JSON.stringify(itemMemosPayload)}
        />

        {/* ⑥ 明細テーブル（明細・価格は read-only、メモ列のみ編集可）。 */}
        <LineTable
          lines={linesWithMemos}
          activeRowId={null}
          onSelectRow={() => {}}
          memoEdit
          onChangeMemo={patchItemMemo}
        />

        {/* ⑧ バリ単位メモ（conform 管理・uncontrolled）。 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div>
            <label htmlFor={fields.customerMemo.id} className="text-sm font-bold text-gray-700">
              顧客メモ
            </label>
            <textarea
              id={fields.customerMemo.id}
              name={fields.customerMemo.name}
              defaultValue={variation.customerMemo}
              rows={3}
              className="mt-1 w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label htmlFor={fields.internalMemo.id} className="text-sm font-bold text-gray-700">
              社内メモ
            </label>
            <textarea
              id={fields.internalMemo.id}
              name={fields.internalMemo.name}
              defaultValue={variation.internalMemo}
              rows={3}
              className="mt-1 w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "保存中..." : "メモを保存"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded disabled:cursor-not-allowed"
          >
            キャンセル
          </button>
        </div>
      </form>
    </>
  );
}
