"use client";

import { useActionState } from "react";
import { deleteRole } from "./actions";

type Props = {
  roleId: string;
};

export function RoleDeleteForm({ roleId }: Props) {
  const [deleteState, formAction, isPending] = useActionState(deleteRole, {
    success: true,
  });

  return (
    <div className="mt-4">
      {/* エラーメッセージ表示 */}
      {!deleteState.success && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          <p>{deleteState.error}</p>
        </div>
      )}

      <form noValidate action={formAction}>
        {/* hidden inputでIDを渡す */}
        <input type="hidden" name="id" value={roleId} />

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
