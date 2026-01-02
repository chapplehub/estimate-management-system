"use client";

import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateEmployee } from "./actions";
import { updateEmployeeSchema } from "./schema";

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
  // LEARN: bind()でemployeeCdを事前にバインド(server-action-bind-vs-formdata.md)
  const updateEmployeeWithEmployeeCd = updateEmployee.bind(
    null,
    employee.employeeCd
  );

  const [lastResult, formAction, isPending] = useActionState(
    updateEmployeeWithEmployeeCd,
    undefined
  );

  const [form, fields] = useForm({
    lastResult,
    defaultValue: {
      name: employee.name,
      email: employee.email,
      role: employee.role,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: updateEmployeeSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  // 成功時のトースト表示
  useEffect(() => {
    if (lastResult?.status === "success") {
      toast.success("従業員情報を更新しました。");
    }
  }, [lastResult]);

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

      <form
        {...getFormProps(form)}
        action={formAction}
        noValidate
        className="space-y-4"
      >
        <div>
          <label
            htmlFor={fields.name.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
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
          <label
            htmlFor={fields.email.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
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
          <p className="text-gray-600 text-xs mt-1">
            形式: EMP + 6桁の数字（例: EMP000001）
          </p>
        </div>

        <div>
          <label
            htmlFor={fields.role.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            権限
          </label>
          <select
            {...getSelectProps(fields.role)}
            disabled={isPending || !canUpdate}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="USER">一般ユーザー</option>
            <option value="ADMIN">管理者</option>
          </select>
          {fields.role.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.role.errorId}>
              {fields.role.errors[0]}
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
