"use client";

import { useState } from "react";
import type { SuggestedProduct } from "../../_shared/selection-actions";
import { PRODUCT_CATEGORY_LABELS } from "../../_shared/labels";

type Props = {
  /** 本体商品名（提案の文脈表示）。 */
  mainProductName: string;
  suggestions: SuggestedProduct[];
  onConfirm: (selected: SuggestedProduct[]) => void;
  onCancel: () => void;
};

/**
 * 周辺商品サジェストダイアログ（D6・計画§6）。
 *
 * 本体追加直後に表示し、有効な周辺商品を「既定チェック済み（追加寄り）」で提案する。確定した
 * 周辺は通常行として本体直下に挿入される（親に金額集約しない）。カスケードなし（1段のみ）。
 */
export function ProductSuggestDialog({ mainProductName, suggestions, onConfirm, onCancel }: Props) {
  // 既定で全件チェック（追加寄り・計画§6）。
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(suggestions.map((s) => s.id))
  );

  const toggle = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const checkedCount = checkedIds.size;

  return (
    <div
      role="dialog"
      aria-label="周辺商品の提案"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-white rounded shadow-lg w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-bold">周辺商品の提案</h2>
          <p className="text-sm text-gray-600 mt-1">
            「{mainProductName}」と一緒に追加する周辺商品を選択してください。
          </p>
        </div>

        <ul className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {suggestions.map((s) => (
            <li key={s.id}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkedIds.has(s.id)}
                  onChange={() => toggle(s.id)}
                  aria-label={`周辺商品 ${s.name}`}
                  className="h-4 w-4"
                />
                <span className="flex-1">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-gray-500 text-sm">
                    （{s.code}・{PRODUCT_CATEGORY_LABELS[s.category] ?? s.category}）
                  </span>
                </span>
                <span className="text-sm text-gray-600">
                  数量 {s.quantity}
                  {s.unit}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-4 border-t px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
          >
            追加しない
          </button>
          <button
            type="button"
            onClick={() => onConfirm(suggestions.filter((s) => checkedIds.has(s.id)))}
            disabled={checkedCount === 0}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {checkedCount}件を追加
          </button>
        </div>
      </div>
    </div>
  );
}
