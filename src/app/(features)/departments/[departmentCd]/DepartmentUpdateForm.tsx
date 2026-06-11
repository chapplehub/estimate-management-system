"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { updateDepartment } from "./actions";
import { updateDepartmentSchema } from "./schema";

type Department = {
  id: string;
  departmentCd: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
  parentId: string | null;
  /** 楽観ロックトークン（ADR-0039）。hidden input でフォーム往復させる */
  version: number;
};

type Props = {
  department: Department;
  canUpdate: boolean;
  /** 親部署選択フィールド（Server Component を slot として受け取る） */
  parentDepartmentSelectSlot: React.ReactNode;
};

export function DepartmentUpdateForm({ department, canUpdate, parentDepartmentSelectSlot }: Props) {
  const updateDepartmentWithCd = updateDepartment.bind(null, department.departmentCd);

  const { form, fields, isPending } = useServerForm({
    action: updateDepartmentWithCd,
    schema: updateDepartmentSchema,
    defaultValue: {
      name: department.name,
      abbreviation: department.abbreviation,
      parentId: department.parentId ?? "",
      isActive: department.isActive,
      version: department.version,
    },
  });

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">
        {canUpdate ? "部署変更" : "部署詳細"}
      </h2>

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
        {/* 楽観ロックトークン（ADR-0039）。画面表示時の version を往復させ、保存時の競合検知に使う */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />

        <div>
          <label
            htmlFor="departmentCd-display"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            部署コード
          </label>
          <input
            type="text"
            id="departmentCd-display"
            value={department.departmentCd}
            disabled
            readOnly
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100"
          />
          <p className="text-gray-600 text-xs mt-1">形式: DEPT + 3桁の数字（例: DEPT001）</p>
        </div>

        <div>
          <label htmlFor={fields.name.id} className="block text-gray-700 text-sm font-bold mb-2">
            部署名
          </label>
          <input
            {...getInputProps(fields.name, { type: "text" })}
            disabled={isPending || !canUpdate}
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
            htmlFor={fields.abbreviation.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            略称
          </label>
          <input
            {...getInputProps(fields.abbreviation, { type: "text" })}
            disabled={isPending || !canUpdate}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.abbreviation.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.abbreviation.errorId}>
              {fields.abbreviation.errors[0]}
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

        <div className="flex items-center">
          <input
            {...getInputProps(fields.isActive, { type: "checkbox" })}
            disabled={isPending || !canUpdate}
            className="mr-2 leading-tight"
          />
          <label htmlFor={fields.isActive.id} className="text-gray-700 text-sm font-bold">
            有効
          </label>
        </div>

        {canUpdate && (
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isPending ? "更新中..." : "更新"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
