export type SearchParams = { [key: string]: string | string[] | undefined };

export const LIST_PAGE_DEFAULTS = {
  PAGE_SIZE: 100,
  MAX_PAGES: 10,
} as const;

export function getStringParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return undefined;
}

export function getPageParam(
  params: SearchParams,
  maxPages = LIST_PAGE_DEFAULTS.MAX_PAGES
): number {
  const value = params["page"];
  if (typeof value === "string") {
    const page = parseInt(value, 10);
    if (!isNaN(page) && page >= 1 && page <= maxPages) {
      return page;
    }
  }
  return 1;
}
