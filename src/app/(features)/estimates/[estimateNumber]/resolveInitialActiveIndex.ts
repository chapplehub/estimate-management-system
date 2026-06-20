import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";

/**
 * バリエーションタブの初期選択 index を決める純関数。
 *
 * この関数が参照するのは各バリの status と配列順（index）のみ。variations は variationNumber
 * 昇順で渡される前提（{@link VariationDTO} 群の不変条件）。
 */
export function resolveInitialActiveIndex(
  variations: readonly Pick<VariationDTO, "status">[],
  options: { focusLast?: boolean } = {}
): number {
  // 追加・複製直後は末尾（最大番号）の新バリを選ぶ（§A.2・max+1 採番で末尾に来る）。
  if (options.focusLast && variations.length > 0) {
    return variations.length - 1;
  }
  // 既定タブ＝最小番号の ACTIVE バリ。全 INACTIVE（または空）なら先頭（0）。
  const firstActive = variations.findIndex((v) => v.status === "ACTIVE");
  return firstActive >= 0 ? firstActive : 0;
}
