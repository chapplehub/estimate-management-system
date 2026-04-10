"use client";

import { startTransition, useActionState, useState } from "react";
import { CATEGORY_LABELS } from "../../_shared/labels";
import { type SetRelationsState, setProductRelations } from "./actions";

type Relation = {
  code: string;
  name: string;
  category: string;
  quantity: number;
};

type Props = {
  productCode: string;
  initialRelations: {
    relatedProductId: string;
    relatedProductCode: string;
    relatedProductName: string;
    relatedProductCategory: string;
    quantity: number;
  }[];
};

export function ProductRelationsForm({ productCode, initialRelations }: Props) {
  const action = setProductRelations.bind(null, productCode);
  const [state, formAction, isPending] = useActionState<SetRelationsState, FormData>(action, null);

  const [relations, setRelations] = useState<Relation[]>(
    initialRelations.map((r) => ({
      code: r.relatedProductCode,
      name: r.relatedProductName,
      category: r.relatedProductCategory,
      quantity: r.quantity,
    }))
  );

  const [newCode, setNewCode] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [clientError, setClientError] = useState<string | null>(null);

  const handleAdd = () => {
    setClientError(null);
    const code = newCode.trim().toUpperCase();

    if (!code) {
      setClientError("商品コードを入力してください");
      return;
    }

    if (code === productCode) {
      setClientError("自分自身を周辺商品に設定できません");
      return;
    }

    if (relations.some((r) => r.code === code)) {
      setClientError("この商品は既に追加されています");
      return;
    }

    const qty = Number.parseInt(newQuantity, 10);
    if (Number.isNaN(qty) || qty < 1) {
      setClientError("数量は1以上の整数を入力してください");
      return;
    }

    setRelations([...relations, { code, name: "", category: "", quantity: qty }]);
    setNewCode("");
    setNewQuantity("1");
  };

  const handleRemove = (code: string) => {
    setRelations(relations.filter((r) => r.code !== code));
  };

  const handleQuantityChange = (code: string, value: string) => {
    const qty = Number.parseInt(value, 10);
    if (Number.isNaN(qty) || qty < 1) return;
    setRelations(relations.map((r) => (r.code === code ? { ...r, quantity: qty } : r)));
  };

  const handleSubmit = () => {
    setClientError(null);
    const formData = new FormData();
    formData.set(
      "relations",
      JSON.stringify(relations.map((r) => ({ code: r.code, quantity: r.quantity })))
    );
    startTransition(() => {
      formAction(formData);
    });
  };

  const displayError = clientError || (state && !state.success ? state.error : null);

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">周辺商品設定</h2>

      {displayError && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p>{displayError}</p>
        </div>
      )}

      {relations.length > 0 ? (
        <table className="w-full text-left mb-6">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-sm font-bold text-gray-700">商品コード</th>
              <th className="py-2 text-sm font-bold text-gray-700">商品名</th>
              <th className="py-2 text-sm font-bold text-gray-700">区分</th>
              <th className="py-2 text-sm font-bold text-gray-700 text-right">数量</th>
              <th className="py-2 text-sm font-bold text-gray-700" />
            </tr>
          </thead>
          <tbody>
            {relations.map((rel) => (
              <tr key={rel.code} className="border-b">
                <td className="py-2">{rel.code}</td>
                <td className="py-2">{rel.name || "—"}</td>
                <td className="py-2">
                  {rel.category ? (CATEGORY_LABELS[rel.category] ?? rel.category) : "—"}
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    min="1"
                    value={rel.quantity}
                    onChange={(e) => handleQuantityChange(rel.code, e.target.value)}
                    disabled={isPending}
                    className="w-20 text-right border rounded py-1 px-2 disabled:bg-gray-100"
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemove(rel.code)}
                    disabled={isPending}
                    className="text-red-600 hover:text-red-800 text-sm disabled:text-gray-400"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-500 mb-6">周辺商品が設定されていません</p>
      )}

      <div className="flex gap-2 items-end mb-6 border-t pt-4">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-1">商品コード</label>
          <input
            type="text"
            value={newCode}
            onChange={(e) => {
              setNewCode(e.target.value);
              setClientError(null);
            }}
            disabled={isPending}
            placeholder="例: PRD001"
            className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-1">数量</label>
          <input
            type="number"
            min="1"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            disabled={isPending}
            className="shadow appearance-none border rounded w-20 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
        >
          追加
        </button>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isPending ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
