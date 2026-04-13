"use client";

import { useCallback, useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { ModalSearchForm } from "@/app/_components/shared/ModalSearchForm";
import { DataTable, type ColumnDef } from "@/app/_components/shared/DataTable";

type SelectionModalProps<TData> = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  searchFields: SearchFieldDef[];
  searchAction: (criteria: Record<string, string>) => Promise<TData[]>;
  columns: ColumnDef<TData, unknown>[];
  onConfirm: (selectedItems: TData[]) => void;
  getRowId: (row: TData) => string;
  emptyMessage: string;
  excludeIds?: string[];
};

export function SelectionModal<TData>({
  isOpen,
  onClose,
  title,
  searchFields,
  searchAction,
  columns,
  onConfirm,
  getRowId,
  emptyMessage,
  excludeIds = [],
}: SelectionModalProps<TData>) {
  const [data, setData] = useState<TData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(
    async (criteria: Record<string, string>) => {
      setIsLoading(true);
      setRowSelection({});
      try {
        const results = await searchAction(criteria);
        const excludeSet = new Set(excludeIds);
        const filtered = results.filter((row) => !excludeSet.has(getRowId(row)));
        setData(filtered);
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    },
    [searchAction, excludeIds, getRowId]
  );

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  const handleConfirm = () => {
    const selectedItems = data.filter((row) => rowSelection[getRowId(row)]);
    onConfirm(selectedItems);
    handleClose();
  };

  const handleClose = () => {
    setData([]);
    setRowSelection({});
    setHasSearched(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <button
          type="button"
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          &times;
        </button>
      </div>

      {/* 検索フォーム */}
      <div className="px-6">
        <ModalSearchForm fields={searchFields} onSearch={handleSearch} isLoading={isLoading} />
      </div>

      {/* テーブル */}
      <div className="flex-1 flex flex-col min-h-0">
        {hasSearched ? (
          <DataTable
            columns={columns}
            data={data}
            emptyMessage={emptyMessage}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            getRowId={getRowId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            検索条件を入力して検索してください
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="flex items-center justify-end gap-4 border-t px-6 py-4">
        <button
          type="button"
          onClick={handleClose}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selectedCount === 0}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {selectedCount}件を追加
        </button>
      </div>
    </div>
  );
}
