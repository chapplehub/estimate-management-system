"use client";

import { getFormProps, getInputProps, getSelectProps, getTextareaProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { CATEGORY_LABELS } from "../../_shared/labels";
import { updateProduct } from "./actions";
import { updateProductSchema } from "./schema";

type Product = {
  code: string;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  note: string | null;
  costPrice: number | null;
};

type Props = {
  product: Product;
};

export function ProductEditForm({ product }: Props) {
  const updateProductWithCd = updateProduct.bind(null, product.code);

  const { form, fields, isPending } = useServerForm({
    action: updateProductWithCd,
    schema: updateProductSchema,
    defaultValue: {
      code: product.code,
      name: product.name,
      category: product.category,
      unit: product.unit,
      description: product.description ?? "",
      note: product.note ?? "",
      costPrice: product.costPrice !== null ? String(product.costPrice) : "",
    },
  });

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">商品編集</h2>

      {form.errors && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          <p>{form.errors}</p>
        </div>
      )}

      <form {...getFormProps(form)} noValidate className="space-y-4">
        <div>
          <label htmlFor={fields.code.id} className="block text-gray-700 text-sm font-bold mb-2">
            商品コード
          </label>
          <input
            {...getInputProps(fields.code, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.code.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.code.errorId}>
              {fields.code.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fields.name.id} className="block text-gray-700 text-sm font-bold mb-2">
            商品名
          </label>
          <input
            {...getInputProps(fields.name, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.name.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.name.errorId}>
              {fields.name.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.category.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            商品区分
          </label>
          <select
            {...getSelectProps(fields.category)}
            disabled
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100"
          >
            <option value={product.category}>
              {CATEGORY_LABELS[product.category] ?? product.category}
            </option>
          </select>
          <p className="text-gray-600 text-xs mt-1">商品区分は変更できません</p>
        </div>

        <div>
          <label htmlFor={fields.unit.id} className="block text-gray-700 text-sm font-bold mb-2">
            単位
          </label>
          <select
            {...getSelectProps(fields.unit)}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="UNIT">台</option>
            <option value="PIECE">個</option>
            <option value="ROLL">本</option>
            <option value="BOX">箱</option>
            <option value="SHEET">枚</option>
            <option value="SET">セット</option>
          </select>
          {fields.unit.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.unit.errorId}>
              {fields.unit.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.costPrice.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            原価
          </label>
          <input
            {...getInputProps(fields.costPrice, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.costPrice.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.costPrice.errorId}>
              {fields.costPrice.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.description.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            商品説明
          </label>
          <textarea
            {...getTextareaProps(fields.description)}
            disabled={isPending}
            rows={3}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.description.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.description.errorId}>
              {fields.description.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fields.note.id} className="block text-gray-700 text-sm font-bold mb-2">
            備考
          </label>
          <textarea
            {...getTextareaProps(fields.note)}
            disabled={isPending}
            rows={3}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.note.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.note.errorId}>
              {fields.note.errors[0]}
            </p>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "更新中..." : "更新"}
          </button>
        </div>
      </form>
    </div>
  );
}
