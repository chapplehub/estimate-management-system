"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useState } from "react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import type {
  LineDTO,
  VariationDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { inputClass, memoInputClass } from "../_shared/formStyles";
import { formatYen } from "../_shared/labels";
import { LineTable, type MemoPatch, type PricePatch } from "./components/LineTable";
import { lineGross, previewVariationTotals, type PreviewLine } from "./previewAmounts";
import { updateVariationAdjustment } from "./actions";
import { updateVariationAdjustmentSchema } from "./variationAdjustSchema";

type Props = {
  estimateNumber: string;
  /** 集約ルートの楽観ロックトークン（ADR-0039）。 */
  version: number;
  variation: VariationDTO;
  /** 消費税率（金額プレビュー用・見積時点スナップショット）。 */
  taxRate: number;
  /** 税端数区分（金額プレビュー用）。 */
  taxRoundingType: string;
  onCancel: () => void;
};

/** 明細調整の作業状態（itemId キー）。LineTable の価格・メモ編集と双方向。 */
type ItemAdjustState = Record<
  string,
  {
    unitPrice: number;
    discountRate: number;
    itemDiscount: number;
    customerMemo: string;
    internalMemo: string;
  }
>;

/** 明細行（通常明細＋構成明細）を平坦化し itemId→調整初期値 を作る（セット群自身は対象外）。 */
function buildInitialItemAdjust(variation: VariationDTO): ItemAdjustState {
  const state: ItemAdjustState = {};
  const put = (l: LineDTO) => {
    state[l.itemId] = {
      unitPrice: l.unitPrice,
      discountRate: l.discountRate,
      itemDiscount: l.itemDiscount,
      customerMemo: l.customerMemo,
      internalMemo: l.internalMemo,
    };
  };
  for (const node of variation.lines) {
    if (node.kind === "setGroup") node.components.forEach(put);
    else put(node);
  }
  return state;
}

/**
 * 改訂先バリエーションの部分編集フォーム（#390）。
 *
 * 改訂先は商品・数量・改訂価格・行構成が固定（ADR-0060）のため、{@link LineTable} を priceEdit＋
 * memoEdit で出し、単価・掛率・明細値引・明細メモだけを編集させる（数量・商品・単位は read-only）。
 * 明細調整は itemId キーの作業 state で controlled に持ち、submit 時に単一 hidden へ JSON 化して
 * 往復する（往復形状・ADR-0050）。LineTable は `line.*` を入力値に使う契約のため、DTO の lines に
 * 作業 state を写し込んだ派生配列を渡す。全体値引・バリ単位メモはスカラーゆえ conform 管理。
 * version・variationId は hidden で往復（ADR-0039）。合計粗利をライブ表示し逆ザヤを赤字で示す。
 * 成功時は Server Action が閲覧へ redirect する。
 */
export function VariationAdjustForm({
  estimateNumber,
  version,
  variation,
  taxRate,
  taxRoundingType,
  onCancel,
}: Props) {
  const action = updateVariationAdjustment.bind(null, estimateNumber);
  const { form, fields, isPending } = useServerForm({
    action,
    schema: updateVariationAdjustmentSchema,
    defaultValue: {
      version: String(version),
      variationId: variation.variationId,
      overallDiscount: String(variation.overallDiscount),
      customerMemo: variation.customerMemo,
      internalMemo: variation.internalMemo,
    },
  });

  const [items, setItems] = useState<ItemAdjustState>(() => buildInitialItemAdjust(variation));
  // 全体値引は粗利・合計プレビューに効くため controlled で持つ。
  const [overallDiscount, setOverallDiscount] = useState<number>(variation.overallDiscount);

  function patchPrice(itemId: string, patch: PricePatch): void {
    setItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId]!, ...patch } }));
  }
  function patchMemo(itemId: string, patch: MemoPatch): void {
    setItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId]!, ...patch } }));
  }

  // LineTable の入力値（line.*）に作業 state を写し込んだ派生 lines。
  const applyAdjust = (l: LineDTO): LineDTO => {
    const a = items[l.itemId];
    return a
      ? {
          ...l,
          unitPrice: a.unitPrice,
          discountRate: a.discountRate,
          itemDiscount: a.itemDiscount,
          customerMemo: a.customerMemo,
          internalMemo: a.internalMemo,
        }
      : l;
  };
  const linesWithAdjust = variation.lines.map((node) =>
    node.kind === "setGroup"
      ? { ...node, components: node.components.map(applyAdjust) }
      : applyAdjust(node)
  );

  // 平坦化した明細（プレビュー集計・合計粗利用）。
  const flatLines: LineDTO[] = linesWithAdjust.flatMap((node) =>
    node.kind === "setGroup" ? node.components : [node]
  );
  const previewLines: PreviewLine[] = flatLines.map((l) => ({
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discountRate: l.discountRate,
    itemDiscount: l.itemDiscount,
  }));
  // 合計粗利＝Σ行粗利（改訂明細のみ・§8.4・LineTable の粗利列と同一定義 lineGross）。
  const totalGross = flatLines.reduce((acc, l) => acc + (lineGross(l) ?? 0), 0);
  const totals = previewVariationTotals({
    lines: previewLines,
    overallDiscount,
    taxRate,
    taxRoundingType,
  });

  const itemsPayload = Object.entries(items).map(([itemId, a]) => ({ itemId, ...a }));

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

      <div className="bg-blue-50 border border-blue-300 text-blue-800 px-4 py-2 rounded mb-4 text-sm">
        改訂先バリエーションです。単価・掛率・値引・メモを調整できます（商品・数量・行構成は固定）。
      </div>

      <form {...getFormProps(form)} noValidate>
        {/* 楽観ロックトークン・対象バリ。 */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />
        <input type="hidden" name={fields.variationId.name} value={variation.variationId} />
        {/* 明細調整（作業 state を JSON 化して往復・ADR-0050）。 */}
        <input type="hidden" name={fields.items.name} value={JSON.stringify(itemsPayload)} />

        {/* ⑥ 明細テーブル（価格＋メモ編集可、商品・数量・単位は read-only。粗利列つき）。 */}
        <LineTable
          lines={linesWithAdjust}
          activeRowId={null}
          onSelectRow={() => {}}
          priceEdit
          onChangePrice={patchPrice}
          memoEdit
          onChangeMemo={patchMemo}
        />

        {/* ⑦ 全体値引（controlled・プレビュー反映）。 */}
        <div className="mt-4 flex justify-end">
          <div className="w-full md:w-80">
            <label htmlFor={fields.overallDiscount.id} className="text-sm font-bold text-gray-700">
              全体値引（円）
            </label>
            <input
              id={fields.overallDiscount.id}
              name={fields.overallDiscount.name}
              type="number"
              min={0}
              step={1}
              value={overallDiscount}
              onChange={(e) => setOverallDiscount(Number(e.target.value) || 0)}
              className={`${inputClass} text-right`}
            />
          </div>
        </div>

        {/* 合計粗利（ライブ近似・±1円。逆ザヤは赤字）。 */}
        <div className="mt-4 flex justify-end">
          <dl className="w-full md:w-80 space-y-1 text-sm">
            <div className="flex justify-between py-1 text-gray-700">
              <dt>小計</dt>
              <dd>{formatYen(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between py-1 text-gray-700">
              <dt>税込合計</dt>
              <dd>{formatYen(totals.finalTotal)}</dd>
            </div>
            <div
              className={`flex justify-between border-t pt-2 font-bold ${
                totalGross < 0 ? "text-red-600" : "text-gray-900"
              }`}
            >
              <dt>合計粗利</dt>
              <dd aria-label="合計粗利">{formatYen(totalGross)}</dd>
            </div>
          </dl>
        </div>

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
              className={memoInputClass}
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
              className={memoInputClass}
            />
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "保存中..." : "価格を保存"}
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
