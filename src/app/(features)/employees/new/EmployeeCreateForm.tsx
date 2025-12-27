"use client";

import {
  useForm,
  getFormProps,
  getInputProps,
  getSelectProps,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useActionState } from "react";
import { createEmployee } from "./actions";
import { createEmployeeSchema } from "./schema";

export function EmployeeCreateForm() {
  const [lastResult, formAction, isPending] = useActionState(
    createEmployee,
    undefined
  );

  const [form, fields] = useForm({
    lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createEmployeeSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
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
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="山田太郎"
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
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="yamada@example.com"
          />
          {fields.email.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.email.errorId}>
              {fields.email.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.employeeCd.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            従業員コード
          </label>
          <input
            {...getInputProps(fields.employeeCd, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="EMP000001"
          />
          {fields.employeeCd.errors ? (
            <p
              className="text-red-500 text-xs mt-1"
              id={fields.employeeCd.errorId}
            >
              {fields.employeeCd.errors[0]}
            </p>
          ) : (
            <p className="text-gray-600 text-xs mt-1">
              形式: EMP + 6桁の数字（例: EMP000001）
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.password.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            パスワード
          </label>
          <input
            {...getInputProps(fields.password, { type: "password" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="8文字以上"
          />
          {fields.password.errors && (
            <p
              className="text-red-500 text-xs mt-1"
              id={fields.password.errorId}
            >
              {fields.password.errors[0]}
            </p>
          )}
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
            defaultValue="USER"
            disabled={isPending}
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
