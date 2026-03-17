"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { createDepartment } from "./actions";
import { createDepartmentSchema } from "./schema";

type Props = {
  /** 親部署選択フィールド（Server Component を slot として受け取る） */
  parentDepartmentSelectSlot: React.ReactNode;
};

export function DepartmentCreateForm({ parentDepartmentSelectSlot }: Props) {
  const { form, fields, isPending } = useServerForm({
    action: createDepartment,
    schema: createDepartmentSchema,
  });

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      {/* 全体エラーメッセージ表示 */}
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
          <label
            htmlFor={fields.departmentCd.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            部署コード
          </label>
          <input
            {...getInputProps(fields.departmentCd, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="DEPT001"
          />
          {fields.departmentCd.errors ? (
            <p className="text-red-500 text-xs mt-1" id={fields.departmentCd.errorId}>
              {fields.departmentCd.errors[0]}
            </p>
          ) : (
            <p className="text-gray-600 text-xs mt-1">形式: DEPT + 3桁の数字</p>
          )}
        </div>

        <div>
          <label htmlFor={fields.name.id} className="block text-gray-700 text-sm font-bold mb-2">
            部署名
          </label>
          <input
            {...getInputProps(fields.name, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="営業部"
          />
          {fields.name.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.name.errorId}>
              {fields.name.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.abbreviation.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            略称
          </label>
          <input
            {...getInputProps(fields.abbreviation, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="営業"
          />
          {fields.abbreviation.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.abbreviation.errorId}>
              {fields.abbreviation.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.displayOrder.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            表示順
          </label>
          <input
            {...getInputProps(fields.displayOrder, { type: "number" })}
            defaultValue={0}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.displayOrder.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.displayOrder.errorId}>
              {fields.displayOrder.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="parentId" className="block text-gray-700 text-sm font-bold mb-2">
            親部署
          </label>
          {parentDepartmentSelectSlot}
          {fields.parentId.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.parentId.errorId}>
              {fields.parentId.errors[0]}
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
