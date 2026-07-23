"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { SelectionModal } from "@/app/_components/shared/SelectionModal";
import { searchCustomersForSelection } from "../../estimates/_shared/selection-actions";
import { companySelectionColumns, type CompanyRow } from "../../estimates/_shared/selectionColumns";

const customerSearchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "名称", placeholder: "部分一致" },
];

/**
 * 得意先を1件選んで得意先別販売単価一覧（`/customer-selling-prices/[customerCd]`）へ遷移する
 * セレクタ（#508）。見積系と同じ SelectionModal ＋ searchCustomersForSelection（有効得意先のみ）を
 * 流用し（#351・部品の原子で統一）、選択の確定は URL（パスセグメント）への push で表す。
 * 未選択画面の初回選択と、一覧画面での得意先切り替えの両方で使う。
 */
export function CustomerSelector({ label }: { label: string }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConfirm = (selected: CompanyRow[]) => {
    const customer = selected[0];
    if (customer) {
      router.push(`/customer-selling-prices/${customer.code}`);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
      >
        {label}
      </button>
      <SelectionModal<CompanyRow>
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="得意先を選択"
        searchFields={customerSearchFields}
        searchAction={searchCustomersForSelection}
        searchActionName="searchCustomersForSelection"
        columns={companySelectionColumns}
        onConfirm={handleConfirm}
        getRowId={(row) => row.id}
        emptyMessage="該当する得意先が見つかりません"
      />
    </>
  );
}
