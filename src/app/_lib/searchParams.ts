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

/**
 * 繰り返しパラメータ（`?state=A&state=B`）を `string[]` へ正規化する。
 * Next.js の searchParams は同一キーが複数あれば `string[]`、1 個なら `string` で渡すため、
 * どちらでも配列に揃える。値が無い／空要素のみのときは undefined（＝絞り込まない）を返す。
 */
export function getArrayParam(params: SearchParams, key: string): string[] | undefined {
  const value = params[key];
  const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const cleaned = raw.map((v) => v.trim()).filter((v) => v !== "");
  return cleaned.length > 0 ? cleaned : undefined;
}
