import {
  SetComponentRule,
  type SetComponentFact,
  type SetComponentWarning,
} from "@subdomains/estimate/domain/services/SetComponentRule";
import { type ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";

/**
 * セット構成検証が必要とする最小の読み取り形状（構造的型）。
 *
 * `VariationContent`（C4・buildVariationContent の出力）と、生成済み集約の `EstimateVariation`
 * ビュー（C1）の双方が満たす。子エンティティ型（EstimateItem 等）を app 層で名指ししないため
 * 構造的に定義する（集約境界・バレル非公開と整合）。
 */
export type SetComponentValidationTarget = {
  items: ReadonlyArray<{
    id: { value: string };
    productId: { value: string };
    itemName: { value: string };
  }>;
  setGroups?: ReadonlyArray<{ memberItemIds: ReadonlyArray<{ value: string }> }>;
};

/**
 * セット群の構成明細について、商品区分・有効性を**ライブ検証**する（ADR-0052 / ADR-0030）。
 *
 * アプリ層が「集約越えの事実」を集める役回り: 構成明細の商品 id を `ProductQueryService` で
 * ライブ取得（作成中は read-through・ADR-0048）し、純粋ドメイン検証 `SetComponentRule` へ
 * メソッド引数で渡す。区分外（セット商品ネスト含む）はハードエラーで throw、無効構成は
 * 非ブロッキング警告として返す。
 *
 * **検証対象は構成明細のみ**（群本体の商品は区分 SET であり、許可区分検証の対象外）。
 * 自動展開しか UI が無い S5 でも、保存時のこのライブ検証が**ペイロード防御**として効く。
 *
 * 無効構成の警告は UI が `LineDTO.isActive` から状態導出するため、戻り値の warning は
 * 呼び出し側で必須ではない（ハードエラーの throw が主目的）。返すのは将来の利用・テスト容易性のため。
 */
export async function assertSetComponentsValid(
  content: SetComponentValidationTarget,
  productQueryService: ProductQueryService
): Promise<SetComponentWarning[]> {
  const setGroups = content.setGroups ?? [];
  if (setGroups.length === 0) {
    return [];
  }

  // セット群の memberItemIds（構成明細 id）→ content.items の実体 → 商品 id を解決する。
  const componentItemIds = new Set(setGroups.flatMap((g) => g.memberItemIds.map((id) => id.value)));
  const componentItems = content.items.filter((i) => componentItemIds.has(i.id.value));
  if (componentItems.length === 0) {
    return [];
  }

  const productIds = [...new Set(componentItems.map((i) => i.productId.value))];
  const products = await productQueryService.findByIds(productIds);
  const byId = new Map(products.map((p) => [p.id, p]));

  // 構成明細ごとに商品事実を組む。商品が解決できない構成は検証対象から除く
  // （参照整合は別関心。realistic には全構成商品が存在する）。
  const facts: SetComponentFact[] = componentItems.flatMap((item) => {
    const product = byId.get(item.productId.value);
    if (!product) {
      return [];
    }
    return [
      {
        productId: item.productId.value,
        itemName: item.itemName.value,
        category: product.category,
        isActive: product.isActive,
      },
    ];
  });

  return SetComponentRule.validate(facts);
}
