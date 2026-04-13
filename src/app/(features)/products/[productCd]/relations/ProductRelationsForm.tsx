"use client";

import { startTransition, useActionState, useState } from "react";
import { CATEGORY_LABELS } from "../../_shared/labels";
import { type SetRelationsState, setProductRelations } from "./actions";
import { SelectionModal } from "@/app/_components/shared/SelectionModal";
import { searchProductsForSelection } from "../../_shared/actions";
import { selectionColumns, type ProductRow } from "../../_shared/selectionColumns";
import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";

type Relation = {
  id: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
};

type Props = {
  productCode: string;
  productId: string;
  initialRelations: {
    relatedProductId: string;
    relatedProductCode: string;
    relatedProductName: string;
    relatedProductCategory: string;
    quantity: number;
  }[];
};

const productSearchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "商品コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "商品名", placeholder: "部分一致" },
  {
    type: "select",
    key: "category",
    label: "商品区分",
    options: [
      { value: "INDIVIDUAL", label: "個別商品" },
      { value: "CONSUMABLE", label: "消耗品" },
      { value: "SET", label: "セット商品" },
    ],
  },
];

export function ProductRelationsForm({ productCode, productId, initialRelations }: Props) {
  const action = setProductRelations.bind(null, productCode);
  const [state, formAction, isPending] = useActionState<SetRelationsState, FormData>(action, null);

  const [relations, setRelations] = useState<Relation[]>(
    initialRelations.map((r) => ({
      id: r.relatedProductId,
      code: r.relatedProductCode,
      name: r.relatedProductName,
      category: r.relatedProductCategory,
      quantity: r.quantity,
    }))
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const excludeIds = [productId, ...relations.map((r) => r.id)];

  const handleConfirmSelection = (selectedProducts: ProductRow[]) => {
    const newRelations: Relation[] = selectedProducts.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      quantity: 1,
    }));
    setRelations((prev) => [...prev, ...newRelations]);
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
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={isPending}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
        >
          商品を追加
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

      <SelectionModal<ProductRow>
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="商品を選択"
        searchFields={productSearchFields}
        searchAction={searchProductsForSelection}
        columns={selectionColumns}
        onConfirm={handleConfirmSelection}
        getRowId={(row) => row.id}
        emptyMessage="該当する商品が見つかりません"
        excludeIds={excludeIds}
      />
    </div>
  );
}
