"use client";

import { useState, useMemo, useRef } from "react";
import { getFormProps, getInputProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { createRole } from "./actions";
import { createRoleSchema } from "./schema";

type PositionOption = {
  id: string;
  name: string;
  superiorPositionId: string | null;
};

type RoleOption = {
  id: string;
  name: string;
  positionId: string;
};

type Props = {
  positions: PositionOption[];
  allRoles: RoleOption[];
};

export function RoleCreateForm({ positions, allRoles }: Props) {
  const { form, fields, isPending } = useServerForm({
    action: createRole,
    schema: createRoleSchema,
  });

  const [selectedPositionId, setSelectedPositionId] = useState("");
  const superiorRoleSelectRef = useRef<HTMLSelectElement>(null);

  // 選択した役職の上位役職IDを特定し、その役職に属する役割を上位役割候補とする
  const superiorPositionId = useMemo(
    () => positions.find((p) => p.id === selectedPositionId)?.superiorPositionId ?? null,
    [positions, selectedPositionId]
  );

  const superiorRoleOptions = useMemo(
    () => (superiorPositionId ? allRoles.filter((r) => r.positionId === superiorPositionId) : []),
    [allRoles, superiorPositionId]
  );

  const handlePositionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPositionId(e.target.value);
    // 役職変更時に上位役割の選択をリセット
    if (superiorRoleSelectRef.current) {
      superiorRoleSelectRef.current.value = "";
    }
  };

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
          <label htmlFor={fields.roleCd.id} className="block text-gray-700 text-sm font-bold mb-2">
            役割コード
          </label>
          <input
            {...getInputProps(fields.roleCd, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="ROLE001"
          />
          {fields.roleCd.errors ? (
            <p className="text-red-500 text-xs mt-1" id={fields.roleCd.errorId}>
              {fields.roleCd.errors[0]}
            </p>
          ) : (
            <p className="text-gray-600 text-xs mt-1">形式: ROLE + 3桁の数字</p>
          )}
        </div>

        <div>
          <label htmlFor={fields.name.id} className="block text-gray-700 text-sm font-bold mb-2">
            役割名
          </label>
          <input
            {...getInputProps(fields.name, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="大阪市南課長"
          />
          {fields.name.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.name.errorId}>
              {fields.name.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.positionId.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            役職
          </label>
          <select
            name="positionId"
            id={fields.positionId.id}
            disabled={isPending}
            onChange={handlePositionChange}
            value={selectedPositionId}
            aria-invalid={!!fields.positionId.errors}
            aria-describedby={fields.positionId.errors ? fields.positionId.errorId : undefined}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="" disabled>
              役職を選択してください
            </option>
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
          {fields.positionId.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.positionId.errorId}>
              {fields.positionId.errors[0]}
            </p>
          )}
        </div>

        {selectedPositionId && superiorRoleOptions.length > 0 && (
          <div>
            <label
              htmlFor={fields.superiorRoleId.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              上位役割
            </label>
            <select
              ref={superiorRoleSelectRef}
              name="superiorRoleId"
              id={fields.superiorRoleId.id}
              disabled={isPending}
              defaultValue=""
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            >
              <option value="">上位役割を選択してください</option>
              {superiorRoleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
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

        {selectedPositionId && superiorPositionId === null && (
          <p className="text-gray-500 text-sm">
            この役職には上位役職がないため、上位役割は設定できません。
          </p>
        )}

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
