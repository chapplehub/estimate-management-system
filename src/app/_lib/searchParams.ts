export type SearchParams = { [key: string]: string | string[] | undefined };

/** 一覧画面の最大取得件数（サーバーサイド） */
export const LIST_FETCH_LIMIT = 1000;

/** クライアントサイドページネーションの1ページあたり表示件数 */
export const LIST_PAGE_SIZE = 100;

export function getStringParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return undefined;
}
