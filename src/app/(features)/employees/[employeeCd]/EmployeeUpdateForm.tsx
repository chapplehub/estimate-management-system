"use client";

import { getFormProps, getInputProps, getSelectProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import type { UserRole } from "@server/shared/auth/types";
import { USER_ROLES } from "@server/shared/auth/types";
import { updateEmployee } from "./actions";
import { updateEmployeeSchema } from "./schema";

type Employee = {
  id: string;
  name: string;
  email: string;
  employeeCd: string;
  departmentId: string;
  role: UserRole | null;
  /** 現在の担当役割ID（EmployeeRole から導出、役割なし＝課員は null）。編集画面の preselect に用いる */
  assignedRoleId: string | null;
  /** 楽観ロックトークン（ADR-0039）。編集画面表示時の値をフォームで往復させる */
  version: number;
};

type Props = {
  employee: Employee;
  canUpdate: boolean;
  /** 部署選択フィールド（Server Component を slot として受け取る） */
  departmentSelectSlot: React.ReactNode;
  /** 担当役割の選択肢（page.tsx が findAll で取得し roleCd 昇順で供給） */
  roleOptions: { id: string; name: string }[];
  /**
   * 現在の担当役割において本人が唯一のメンバーか（page.tsx で1回スナップショット・#565 isSoleMember）。
   * 担当役割なし（assignedRoleId==null）のときは false。承認者不在ワーニングの反応表示に使う。
   */
  isSoleMemberOfCurrentRole: boolean;
};

export function EmployeeUpdateForm({
  employee,
  canUpdate,
  departmentSelectSlot,
  roleOptions,
  isSoleMemberOfCurrentRole,
}: Props) {
  // LEARN: bind()でemployeeCdを事前にバインド(server-action-bind-vs-formdata.md)
  const updateEmployeeWithEmployeeCd = updateEmployee.bind(null, employee.employeeCd);

  const { form, fields, isPending } = useServerForm({
    action: updateEmployeeWithEmployeeCd,
    schema: updateEmployeeSchema,
    defaultValue: {
      name: employee.name,
      email: employee.email,
      departmentId: employee.departmentId,
      role: employee.role ?? USER_ROLES.USER,
      // 現在の担当役割を preselect。null（役割なし）は空文字で解除選択にマップ
      roleId: employee.assignedRoleId ?? "",
      version: String(employee.version),
    },
  });

  // 承認者不在ワーニングの反応判定（非ブロッキング）:
  // 本人が現在の担当役割の唯一メンバーで、かつセレクトの値が現在値から変わった（変更 or 解除）とき表示。
  // fields.roleId.value を反応的に読むため conform 配線の getSelectProps が前提。
  // スナップショット（isSoleMemberOfCurrentRole）で十分：陳腐化しても最終整合は承認時の NO_APPROVER が担保。
  const currentRoleId = employee.assignedRoleId;
  const willLeaveCurrentRole =
    currentRoleId != null && isSoleMemberOfCurrentRole && fields.roleId.value !== currentRoleId;
  const currentRoleName = roleOptions.find((role) => role.id === currentRoleId)?.name;

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">
        {canUpdate ? "従業員変更" : "従業員詳細"}
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
        {/* 楽観ロックトークン（ADR-0039）。編集画面表示時の version を往復させる。 */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />
        <div>
          <label htmlFor={fields.name.id} className="block text-gray-700 text-sm font-bold mb-2">
            名前
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
          <label htmlFor={fields.email.id} className="block text-gray-700 text-sm font-bold mb-2">
            メールアドレス
          </label>
          <input
            {...getInputProps(fields.email, { type: "email" })}
            disabled={isPending || !canUpdate}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {fields.email.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.email.errorId}>
              {fields.email.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="employeeCd-display"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            従業員コード
          </label>
          <input
            type="text"
            id="employeeCd-display"
            value={employee.employeeCd}
            disabled
            readOnly
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100"
          />
          <p className="text-gray-600 text-xs mt-1">形式: EMP + 6桁の数字（例: EMP000001）</p>
        </div>

        <div>
          <label htmlFor="departmentId" className="block text-gray-700 text-sm font-bold mb-2">
            所属部署
          </label>
          {departmentSelectSlot}
          {fields.departmentId.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.departmentId.errorId}>
              {fields.departmentId.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fields.role.id} className="block text-gray-700 text-sm font-bold mb-2">
            権限
          </label>
          <select
            {...getSelectProps(fields.role)}
            disabled={isPending || !canUpdate}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value={USER_ROLES.USER}>一般ユーザー</option>
            <option value={USER_ROLES.ADMIN}>管理者</option>
          </select>
          {fields.role.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.role.errorId}>
              {fields.role.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fields.roleId.id} className="block text-gray-700 text-sm font-bold mb-2">
            担当役割
          </label>
          {/* preselect は conform の defaultValue.roleId が担う。承認者不在ワーニングの
              反応性のため権限セレクトと同じく getSelectProps 配線でフォームに値を所有させる。 */}
          <select
            {...getSelectProps(fields.roleId)}
            disabled={isPending || !canUpdate}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="">（担当役割なし）</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          {fields.roleId.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.roleId.errorId}>
              {fields.roleId.errors[0]}
            </p>
          )}
          {/* 承認者不在ワーニング（非ブロッキング）。エラーの role="alert" とは別扱いの role="status"。 */}
          {willLeaveCurrentRole && (
            <div
              role="status"
              aria-live="polite"
              className="mt-2 rounded border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
            >
              ⚠️ この従業員は現在「{currentRoleName}
              」の唯一の担当者です。担当役割を変更・解除しても更新はできますが、この役割の承認が承認者不在になる可能性があります。
            </div>
          )}
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
