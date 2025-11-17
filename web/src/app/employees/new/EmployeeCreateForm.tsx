"use client";

import { createEmployee } from "./actions";
import type { ActionResult } from "@/shared/types/ActionResult";
import { useActionState } from "react";

export function EmployeeCreateForm() {
  const [createState, formAction, isPending] = useActionState(createEmployee, {
    success: true,
  });

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      {/* エラーメッセージ表示 */}
      {!createState.success && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          <p>{createState.error}</p>
        </div>
      )}

      <form action={formAction} className="space-y-4">
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
            required
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="山田太郎"
          />
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
            required
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="yamada@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="employeeCd"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            従業員コード
          </label>
          <input
            type="text"
            id="employeeCd"
            name="employeeCd"
            required
            disabled={isPending}
            pattern="EMP[0-9]{6}"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="EMP000001"
          />
          <p className="text-gray-600 text-xs mt-1">
            形式: EMP + 6桁の数字（例: EMP000001）
          </p>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            パスワード
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            disabled={isPending}
            minLength={8}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="8文字以上"
          />
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
            required
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="USER">一般ユーザー</option>
            <option value="ADMIN">管理者</option>
          </select>
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
