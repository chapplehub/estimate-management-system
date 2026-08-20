import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";

/**
 * 商品選択モーダル（SelectionModal）の検索フィールド定義。商品コード／商品名の部分一致。
 * EstimateHeaderForm・VariationCreateForm・VariationEditForm で共有する（3ファイル完全一致）。
 */
export const productSearchFields: SearchFieldDef[] = [
  { type: "text", key: "code", label: "商品コード", placeholder: "部分一致" },
  { type: "text", key: "name", label: "商品名", placeholder: "部分一致" },
];
