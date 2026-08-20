"use client";

import { getFormProps, getInputProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { updateRole } from "./actions";
import { updateRoleSchema } from "./schema";

type Role = {
  id: string;
  roleCd: string;
  name: string;
  positionName: string;
  superiorRoleId: string | null;
  /** 楽観ロックトークン（ADR-0039）。hidden input で往復させ更新時の競合検知に使う */
  version: number;
};

type SuperiorRoleOption = {
  id: string;
  name: string;
};

type Props = {
  role: Role;
  canUpdate: boolean;
  superiorRoleOptions: SuperiorRoleOption[];
};

export function RoleUpdateForm({ role, canUpdate, superiorRoleOptions }: Props) {
  const updateRoleWithCd = updateRole.bind(null, role.roleCd);

  const { form, fields, isPending } = useServerForm({
    action: updateRoleWithCd,
    schema: updateRoleSchema,
    defaultValue: {
      name: role.name,
      superiorRoleId: role.superiorRoleId ?? "",
      version: role.version,
    },
  });

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">
        {canUpdate ? "役割変更" : "役割詳細"}
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
        {/* 楽観ロックトークン（ADR-0039）。画面表示時の version を更新時まで往復させる */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />

        <div>
          <label htmlFor="roleCd-display" className="block text-gray-700 text-sm font-bold mb-2">
            役割コード
          </label>
          <input
            type="text"
            id="roleCd-display"
            value={role.roleCd}
            disabled
            readOnly
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100"
          />
          <p className="text-gray-600 text-xs mt-1">形式: ROLE + 3桁の数字（変更不可）</p>
        </div>

        <div>
          <label
            htmlFor="positionName-display"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            役職
          </label>
          <input
            type="text"
            id="positionName-display"
            value={role.positionName}
            disabled
            readOnly
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100"
          />
          <p className="text-gray-600 text-xs mt-1">変更不可</p>
        </div>

        <div>
          <label htmlFor={fields.name.id} className="block text-gray-700 text-sm font-bold mb-2">
            役割名
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

        {superiorRoleOptions.length > 0 && (
          <div>
            <label
              htmlFor={fields.superiorRoleId.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              上位役割
            </label>
            <select
              name="superiorRoleId"
              id={fields.superiorRoleId.id}
              defaultValue={role.superiorRoleId ?? ""}
              disabled={isPending || !canUpdate}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            >
              <option value="">上位役割を選択してください</option>
              {superiorRoleOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            {fields.superiorRoleId.errors && (
              <p className="text-red-500 text-xs mt-1" id={fields.superiorRoleId.errorId}>
                {fields.superiorRoleId.errors[0]}
              </p>
            )}
          </div>
        )}

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
