"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { SelectionModal } from "@/app/_components/shared/SelectionModal";
import { searchDeliveryLocationsGlobal } from "./selection-actions";
import {
  deliveryLocationSelectionColumns,
  type DeliveryLocationSelectionRow,
} from "./selectionColumns";

const deliveryLocationSearchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "名称", placeholder: "部分一致" },
];

/**
 * 納品先を1件選んで納品先別販売単価一覧（`/delivery-location-selling-prices/[deliveryLocationCd]`）へ
 * 遷移するセレクタ（#548）。既存 SelectionModal を流用し（#351・部品の原子で統一）、得意先で拘束しない
 * グローバル検索 action ＋ 得意先列付きカラムを配線する。選択の確定は URL（パスセグメント）への push で
 * 表す。未選択画面の初回選択と、一覧画面での納品先切り替えの両方で使う。
 */
export function DeliveryLocationSelector({ label }: { label: string }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConfirm = (selected: DeliveryLocationSelectionRow[]) => {
    const deliveryLocation = selected[0];
    if (deliveryLocation) {
      router.push(`/delivery-location-selling-prices/${deliveryLocation.code}`);
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
      <SelectionModal<DeliveryLocationSelectionRow>
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="納品先を選択"
        searchFields={deliveryLocationSearchFields}
        searchAction={searchDeliveryLocationsGlobal}
        columns={deliveryLocationSelectionColumns}
        onConfirm={handleConfirm}
        getRowId={(row) => row.id}
        emptyMessage="該当する納品先が見つかりません"
      />
    </>
  );
}
