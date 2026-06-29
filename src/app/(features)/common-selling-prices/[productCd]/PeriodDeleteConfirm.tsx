"use client";

import { getFormProps } from "@conform-to/react";
import { useEffect } from "react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { deletePeriodAction } from "./actions";
import { deletePeriodSchema } from "./schema";

type Props = {
  productCd: string;
  periodId: string;
  /** 集約ルートの楽観ロックversion。 */
  version: number;
  onSuccess: () => void;
  onCancel: () => void;
};

/**
 * UC-5 削除の行内2段階確認（決定5）。
 *
 * 将来開始行の [削除] 押下でこの確認に切り替わり、[削除する]/[取消] を提示する。
 * shadcn AlertDialog を使わず、パネル用 client state を流用して追加依存なしで
 * undo 無しの物理削除に最小ガードを掛ける。成功/エラーの解釈は PeriodForm と
 * 同じ conform 機構（form.status / form.errors）に揃える。
 */
export function PeriodDeleteConfirm({ productCd, periodId, version, onSuccess, onCancel }: Props) {
  const { form, fields, isPending } = useServerForm({
    action: deletePeriodAction.bind(null, productCd),
    schema: deletePeriodSchema,
    defaultValue: { version: String(version), periodId },
  });

  // 成功時（redirectせず留まる設計・決定8）にパネルを閉じる。
  useEffect(() => {
    if (form.status === "success") onSuccess();
  }, [form.status, onSuccess]);

  return (
    <div className="flex flex-col gap-1 items-end">
      <form {...getFormProps(form)} noValidate className="flex gap-2 items-center">
        <input type="hidden" name={fields.version.name} value={String(version)} />
        <input type="hidden" name={fields.periodId.name} value={periodId} />
        <span className="text-sm text-gray-700">削除しますか？</span>
        <button
          type="submit"
          disabled={isPending}
          className="bg-red-500 hover:bg-red-700 text-white text-sm font-bold py-1 px-3 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isPending ? "削除中..." : "削除する"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold py-1 px-3 rounded disabled:opacity-50"
        >
          取消
        </button>
      </form>
      {form.errors && (
        <p className="text-red-500 text-xs" role="alert">
          {form.errors[0]}
        </p>
      )}
    </div>
  );
}
