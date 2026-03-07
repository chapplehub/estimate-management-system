"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  /** 表示するページ上限（デフォルト: 10） */
  maxPages?: number;
};

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  maxPages = 10,
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigateToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page === 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  // 表示するページ数の制限（totalPagesとmaxPagesの小さい方）
  const displayTotalPages = Math.min(totalPages, maxPages);

  // ページがない場合は表示しない
  if (totalPages <= 0) {
    return null;
  }

  // 表示する最初と最後のアイテム番号
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  // ページボタンの配列を生成
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];

    // 表示ページ数が少ない場合はすべて表示
    if (displayTotalPages <= 7) {
      for (let i = 1; i <= displayTotalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    // 現在ページを中心に表示
    // 最初の3ページ + ... + 最後の3ページ のパターンを基本とする
    if (currentPage <= 4) {
      // 先頭付近の場合
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push(-1); // -1 は "..." を表す
      pages.push(displayTotalPages);
    } else if (currentPage >= displayTotalPages - 3) {
      // 末尾付近の場合
      pages.push(1);
      pages.push(-1);
      for (let i = displayTotalPages - 4; i <= displayTotalPages; i++) {
        pages.push(i);
      }
    } else {
      // 中間の場合
      pages.push(1);
      pages.push(-1);
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pages.push(i);
      }
      pages.push(-1);
      pages.push(displayTotalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      {/* モバイル用の簡易表示 */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => navigateToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          前へ
        </button>
        <span className="flex items-center text-sm text-gray-700">
          {currentPage} / {displayTotalPages}
        </span>
        <button
          onClick={() => navigateToPage(currentPage + 1)}
          disabled={currentPage >= displayTotalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          次へ
        </button>
      </div>

      {/* デスクトップ用の詳細表示 */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            <span className="font-medium">{totalCount}</span> 件中{" "}
            <span className="font-medium">{startItem}</span> -{" "}
            <span className="font-medium">{endItem}</span> 件を表示
            {totalPages > maxPages && (
              <span className="text-gray-500">（最大 {maxPages} ページまで表示）</span>
            )}
          </p>
        </div>
        <div>
          <nav
            className="isolate inline-flex -space-x-px rounded-md shadow-sm"
            aria-label="Pagination"
          >
            {/* 前へボタン */}
            <button
              onClick={() => navigateToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">前へ</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* ページ番号ボタン */}
            {pageNumbers.map((pageNum, index) =>
              pageNum === -1 ? (
                <span
                  key={`ellipsis-${index}`}
                  className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
                >
                  ...
                </span>
              ) : (
                <button
                  key={pageNum}
                  onClick={() => navigateToPage(pageNum)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 ${
                    pageNum === currentPage
                      ? "z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-blue-600"
                      : "text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              )
            )}

            {/* 次へボタン */}
            <button
              onClick={() => navigateToPage(currentPage + 1)}
              disabled={currentPage >= displayTotalPages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">次へ</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
