import type { ProductDTO } from "@subdomains/product/application/queries/dto/ProductDTO";

/**
 * 自動展開された構成明細 1 件のスナップショット（ADR-0047）。
 *
 * code/name/category/quantity は SET 商品マスタの構成定義（SetProductComponent）から、
 * unit/isActive は構成商品本体の解決結果から取る。単価は要入力（UI が 0 初期化）。
 */
export type ExpandedSetComponent = {
  productId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  /** 構成定義の数量（構成明細の初期数量）。 */
  quantity: number;
  /** 構成商品の有効フラグ。無効でも捨てず警告フラグとして UI に渡す（getProductSuggestions と非対称）。 */
  isActive: boolean;
};

/** 自動展開されたセット群（群ヘッダのスナップショット＋構成明細）。 */
export type ExpandedSetGroup = {
  productId: string;
  code: string;
  name: string;
  unit: string;
  components: ExpandedSetComponent[];
};

/**
 * SET 商品の構成（SetProductComponent）を、明細追加用のセット群スナップショットへ展開する純関数。
 *
 * 単位・有効性は構成定義（SetProductComponentDTO）が持たないため、構成商品本体を `resolveComponent`
 * で解決して補う。**無効構成も捨てない**（セット構成は商品定義そのものゆえ欠けさせない・周辺商品
 * サジェストとは意図的に非対称）。解決できない構成は構成定義の値でフォールバックしつつ含める。
 *
 * SET 以外の商品が渡されたら null（呼び出し側は通常明細として扱う）。
 */
export function toExpandedSetGroup(
  setProduct: ProductDTO,
  resolveComponent: (componentProductId: string) => ProductDTO | null
): ExpandedSetGroup | null {
  if (setProduct.category !== "SET") {
    return null;
  }

  const components: ExpandedSetComponent[] = setProduct.setComponents.map((component) => {
    const resolved = resolveComponent(component.componentProductId);
    return {
      productId: component.componentProductId,
      code: component.componentProductCode,
      name: component.componentProductName,
      category: component.componentProductCategory,
      unit: resolved?.unit ?? "",
      quantity: component.quantity,
      isActive: resolved?.isActive ?? false,
    };
  });

  return {
    productId: setProduct.id,
    code: setProduct.code,
    name: setProduct.name,
    unit: setProduct.unit,
    components,
  };
}
