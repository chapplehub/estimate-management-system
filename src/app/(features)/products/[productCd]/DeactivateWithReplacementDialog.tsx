"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/_components/shadcnui/dialog";
import { startTransition, useActionState, useState } from "react";
import { CATEGORY_LABELS } from "../_shared/labels";
import { deactivateProduct, deactivateWithReplacement } from "./actions";

type Props = {
  productId: string;
  productCd: string;
  referencingProducts: {
    code: string;
    name: string;
    category: string;
  }[];
};

export function DeactivateWithReplacementDialog({
  productId,
  productCd,
  referencingProducts,
}: Props) {
  const replaceAction = deactivateWithReplacement.bind(null, productCd);
  const [replaceState, replaceFormAction, isReplacing] = useActionState(replaceAction, {
    success: true,
  });
  const [deactivateState, deactivateFormAction, isDeactivating] = useActionState(
    deactivateProduct,
    { success: true }
  );

  const [replacementCode, setReplacementCode] = useState("");

  const isPending = isReplacing || isDeactivating;
  const error = !replaceState.success
    ? replaceState.error
    : !deactivateState.success
      ? deactivateState.error
      : null;

  const handleReplaceAndDeactivate = () => {
    const formData = new FormData();
    formData.set("id", productId);
    formData.set("replacementCode", replacementCode.trim().toUpperCase());
    startTransition(() => {
      replaceFormAction(formData);
    });
  };

  const handleDeactivateOnly = () => {
    const formData = new FormData();
    formData.set("id", productId);
    formData.set("productCd", productCd);
    startTransition(() => {
      deactivateFormAction(formData);
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          無効化
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>商品の無効化</DialogTitle>
          <DialogDescription>
            この商品は他の商品から参照されています。入れ替え先を指定して無効化するか、そのまま無効化できます。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded"
            role="alert"
          >
            <p>{error}</p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2">参照元商品</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1 text-gray-700">コード</th>
                <th className="py-1 text-gray-700">商品名</th>
                <th className="py-1 text-gray-700">区分</th>
              </tr>
            </thead>
            <tbody>
              {referencingProducts.map((p) => (
                <tr key={p.code} className="border-b">
                  <td className="py-1">{p.code}</td>
                  <td className="py-1">{p.name}</td>
                  <td className="py-1">{CATEGORY_LABELS[p.category] ?? p.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-bold mb-1">入れ替え先商品コード</label>
          <input
            type="text"
            value={replacementCode}
            onChange={(e) => setReplacementCode(e.target.value)}
            disabled={isPending}
            placeholder="例: PRD001"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleDeactivateOnly}
            disabled={isPending}
            className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isDeactivating ? "処理中..." : "入れ替えずに無効化"}
          </button>
          <button
            type="button"
            onClick={handleReplaceAndDeactivate}
            disabled={isPending || !replacementCode.trim()}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isReplacing ? "処理中..." : "入れ替えて無効化"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
