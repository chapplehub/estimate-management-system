/**
 * ソート方向
 */
export type SortDirection = "asc" | "desc";

/**
 * ソート順の汎用型
 * @template TField ソート可能なフィールド名のユニオン型
 */
export type SortOrder<TField extends string> = {
  field: TField;
  direction: SortDirection;
};
