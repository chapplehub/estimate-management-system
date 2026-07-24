"use client";

import { useCallback, useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { callReadAction } from "@/app/_lib/callReadAction";
import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";
import { ModalSearchForm } from "@/app/_components/shared/ModalSearchForm";
import { DataTable, type ColumnDef } from "@/app/_components/shared/DataTable";

/**
 * 親が確定を拒否するときに `onConfirm` から返す結果（ADR-20260716-r4d）。
 * `message` を出しつつモーダルに留まり、`invalidIds` の行をハイライトする。
 */
export type SelectionRejection = { kind: "rejected"; message: string; invalidIds: string[] };

/**
 * `onConfirm` が返す確定結果。モーダルが取りうる**振る舞い**で枝を切る（原因では切らない）。
 *
 * - `confirmed`: 確定成立。モーダルを閉じて state を破棄する。
 * - `rejected`: 業務上追加できない。閉じずに `message` を出し `invalidIds` の行をハイライトする
 *   （ADR-20260716-r4d）。ユーザーは原因行のチェックだけ外して 1 往復で再確定できる。
 * - `aborted`: 非業務例外（DB 障害・ネットワーク断）で確定に必要なデータを取得できなかった。
 *   閉じず、`rejected` と違い理由も表示しない（通知は `callReadAction` の toast が担うため、
 *   モーダル内にも出すと二重表示になる・ADR-20260723-h7r）。検索結果・選択状態をそのまま残し、
 *   同じ選択のまま再確定でリトライできるようにする（操作中断・state 凍結）。
 *
 * 3 値は判別可能ユニオンであり、リテラルを返して構造で判別する。名前付きシングルトンを export して
 * 同一性比較（`===`）させると、別の場所でインラインに組み立てた値が「型は通るのに一致しない」
 * 罠を残すため設けない。値の不在（`undefined`）にも意味を割り当てない（#634・ADR-20260723-h7r
 * 決定 4）。素の `return;` はコンパイルエラーになり、無言で「確定成立」に化ける経路が消える。
 */
export type SelectionOutcome = { kind: "confirmed" } | SelectionRejection | { kind: "aborted" };

/**
 * `onConfirm` prop の型。props 型ごと export する代わりにこの 1 本だけを名前付きで切り出し、
 * 引数の不変条件の記述場所を 1 箇所に定める（テストの手写し型もここを参照する）。
 *
 * `selectedItems` は**必ず 1 件以上**である（確定ボタンが `selectedCount === 0` で disabled の
 * ため 0 件では呼ばれない）。この不変条件はモーダルが作って `handleConfirm` 冒頭で自己確認する
 * ため、呼び出し元で `rows[0]` の存在を再確認する必要はない。
 */
export type SelectionConfirmHandler<TData> = (
  selectedItems: TData[]
) => SelectionOutcome | Promise<SelectionOutcome>;

type SelectionModalProps<TData> = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  searchFields: SearchFieldDef[];
  searchAction: (criteria: Record<string, string>) => Promise<TData[]>;
  /**
   * `searchAction` に渡した Server Action の**関数名リテラル**（例: `"searchCustomersForSelection"`）。
   * 失敗ログの context に使う（ADR-20260723-h7r）。関数名を知るのは注入側の親だけのため、
   * 包む処理はモーダル内 1 箇所に集約したまま、メタ情報だけを親から供給する。
   * 必須 prop にすることで、新しい親の渡し忘れを TypeScript が検出する。
   */
  searchActionName: string;
  columns: ColumnDef<TData, unknown>[];
  /**
   * 確定時に選択行を受け取り、確定結果（`SelectionOutcome`）を返す。各メンバーに対する
   * モーダルの振る舞いは `SelectionOutcome` の、引数の不変条件は `SelectionConfirmHandler` の
   * JSDoc を参照。
   */
  onConfirm: SelectionConfirmHandler<TData>;
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
  searchActionName,
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
  // 親が確定を拒否したときの理由と原因行（ADR-0015: 表示状態はモーダル内部に閉じる）。
  const [rejection, setRejection] = useState<SelectionRejection | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleSearch = useCallback(
    async (criteria: Record<string, string>) => {
      setIsLoading(true);
      setRowSelection({});
      setRejection(null);
      try {
        const results = await callReadAction(() => searchAction(criteria), searchActionName);
        // 非業務例外での検索失敗時は `data` / `hasSearched` を触らず、直前の検索結果を維持する
        // （操作中断・state 凍結・#633）。通知は callReadAction の toast が担い、`isLoading` は
        // 下の finally が戻すので、ユーザーはそのまま再検索でリトライできる。
        if (results === undefined) return;
        const excludeSet = new Set(excludeIds);
        const filtered = results.filter((row) => !excludeSet.has(getRowId(row)));
        setData(filtered);
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    },
    [searchAction, searchActionName, excludeIds, getRowId]
  );

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;
  const invalidIdSet = new Set(rejection?.invalidIds ?? []);

  // 確定は親の判定待ち。拒否（SelectionRejection）なら閉じずに理由を出し、選択状態は保つ
  // （ユーザーが原因商品のチェックだけ外して再確定できることが拒否経路の目的・ADR-20260716-r4d）。
  const handleConfirm = async () => {
    const selectedItems = data.filter((row) => rowSelection[getRowId(row)]);
    // 「0 件では onConfirm を呼ばない」は確定ボタンの disabled が作る不変条件。ここはその作り手に
    // よる自己確認であり、呼び出し元が各自で再確認する過剰防御とは性質が異なる。
    if (selectedItems.length === 0) return;
    setRejection(null);
    setIsConfirming(true);
    try {
      const outcome = await onConfirm(selectedItems);
      switch (outcome.kind) {
        case "confirmed":
          handleClose();
          return;
        case "rejected":
          setRejection(outcome);
          return;
        // 中断は閉じも拒否表示もせず、画面 state を一切触らずに抜ける。`rejection` を出さないのは
        // toast と二重表示になるため（#633）。`isConfirming` は下の finally が戻すので、同じ選択の
        // まま再確定でリトライできる。
        case "aborted":
          return;
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClose = () => {
    setData([]);
    setRowSelection({});
    setHasSearched(false);
    setRejection(null);
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

      {/* 確定拒否の理由（原因行は data-invalid でハイライトする） */}
      {rejection && (
        <div className="px-6 pb-2">
          <p
            role="alert"
            className="rounded border border-red-300 bg-red-50 px-4 py-2 text-red-700"
          >
            {rejection.message}
          </p>
        </div>
      )}

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
            getRowAttributes={(row) =>
              invalidIdSet.has(getRowId(row))
                ? { className: "bg-red-50", "data-invalid": true }
                : {}
            }
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
          disabled={selectedCount === 0 || isConfirming}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {selectedCount}件を追加
        </button>
      </div>
    </div>
  );
}
