"use client";

import { withCallbacks } from "@/app/_lib/withCallbacks";
import { useActionState } from "react";
import { toast } from "sonner";
import { updateEmployee } from "./actions";

type Employee = {
  id: string;
  name: string;
  email: string;
  employeeCd: string;
  role: "ADMIN" | "USER";
};

type Props = {
  employee: Employee;
  canUpdate: boolean;
};

export function EmployeeUpdateForm({ employee, canUpdate }: Props) {
  const [updateState, formAction, isPending] = useActionState(
    withCallbacks(updateEmployee, {
      onSuccess() {
        toast.success("従業員情報を更新しました。");
      },
    }),
    { success: true }
  );

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">
        {canUpdate ? "従業員変更" : "従業員詳細"}
      </h2>

      {/* 全体エラーメッセージ表示 */}
      {!updateState.success && updateState.error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          <p>{updateState.error}</p>
        </div>
      )}

      <form noValidate action={formAction} className="space-y-4">
        {/* hidden inputでIDと従業員コードを渡す */}
        <input type="hidden" name="id" value={employee.id} />
        <input type="hidden" name="employeeCd" value={employee.employeeCd} />

        <div>
          <label
            htmlFor="name"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            名前
          </label>
          <input
            type="text"
            id="name"
            name="name"
            defaultValue={
              !updateState.success && updateState.data?.name
                ? (updateState.data.name as string)
                : employee.name
            }
            disabled={isPending || !canUpdate}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {!updateState.success && updateState.errors?.name && (
            <p className="text-red-500 text-xs mt-1">
              {updateState.errors.name[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            メールアドレス
          </label>
          <input
            type="email"
            id="email"
            name="email"
            defaultValue={
              !updateState.success && updateState.data?.email
                ? (updateState.data.email as string)
                : employee.email
            }
            disabled={isPending || !canUpdate}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
          {!updateState.success && updateState.errors?.email && (
            <p className="text-red-500 text-xs mt-1">
              {updateState.errors.email[0]}
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
          <p className="text-gray-600 text-xs mt-1">
            形式: EMP + 6桁の数字（例: EMP000001）
          </p>
        </div>

        <div>
          <label
            htmlFor="role"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            権限
          </label>
          <select
            id="role"
            name="role"
            defaultValue={
              !updateState.success && updateState.data?.role
                ? (updateState.data.role as string)
                : employee.role
            }
            disabled={isPending || !canUpdate}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="USER">一般ユーザー</option>
            <option value="ADMIN">管理者</option>
          </select>
          {!updateState.success && updateState.errors?.role && (
            <p className="text-red-500 text-xs mt-1">
              {updateState.errors.role[0]}
            </p>
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
