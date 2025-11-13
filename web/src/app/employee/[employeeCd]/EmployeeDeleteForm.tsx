"use client";

import { deleteEmployee } from "@/app/actions/deleteEmployee";
import { useActionState } from "react";

type Props = {
  employeeId: string;
};

type ActionState =
  | { success: true }
  | { success: false; error: string };

export function EmployeeDeleteForm({ employeeId }: Props) {
  // useActionState 用のラッパー関数
  // 第1引数に state を受け取り、第2引数に FormData を受け取る
  const deleteEmployeeWithId = async (
    _prevState: ActionState,
    _formData: FormData
  ): Promise<ActionState> => {
    return await deleteEmployee(employeeId);
  };

  const [state, formAction, isPending] = useActionState(
    deleteEmployeeWithId,
    { success: true }
  );

  return (
    <div className="mt-4">
      {/* エラーメッセージ表示 */}
      {!state.success && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          <p>{state.error}</p>
        </div>
      )}

      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isPending ? "削除中..." : "削除"}
        </button>
      </form>
    </div>
  );
}
