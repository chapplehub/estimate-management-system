"use client";

import { getFormProps, getInputProps, getSelectProps, getTextareaProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { createProduct } from "./actions";
import { createProductSchema } from "./schema";

export function ProductCreateForm() {
  const { form, fields, isPending } = useServerForm({
    action: createProduct,
    schema: createProductSchema,
  });

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
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
            placeholder="PRD001"
          />
          {fields.code.errors ? (
            <p className="text-red-500 text-xs mt-1" id={fields.code.errorId}>
              {fields.code.errors[0]}
            </p>
          ) : (
            <p className="text-gray-600 text-xs mt-1">英数字のみ、最大50桁</p>
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
            placeholder="標準デスク"
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
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="">選択してください</option>
            <option value="INDIVIDUAL">個別商品</option>
            <option value="CONSUMABLE">消耗品</option>
            <option value="SET">セット商品</option>
          </select>
          {fields.category.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.category.errorId}>
              {fields.category.errors[0]}
            </p>
          )}
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
            <option value="">選択してください</option>
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
            placeholder="商品の説明（任意）"
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
            placeholder="備考（任意）"
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
            {isPending ? "登録中..." : "登録"}
          </button>
        </div>
      </form>
    </div>
  );
}
