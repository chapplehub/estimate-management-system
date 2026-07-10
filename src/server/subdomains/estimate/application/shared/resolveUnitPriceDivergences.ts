import type { UnitPriceDivergence } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import type { TryResolveSellingPriceQuery } from "@subdomains/pricing/application/queries/TryResolveSellingPriceQuery";
import { type LinePriceContext, toSellingPriceTarget } from "./resolveLinePrices";

/**
 * 非 throw の価格決定実行口（ADR-20260626-p3w と同じ構造型受け）。テストで fake 可能なよう
 * `execute` のみを要求する。本物の {@link TryResolveSellingPriceQuery} はこれを満たす。
 */
export type UnitPriceDivergenceResolver = Pick<TryResolveSellingPriceQuery, "execute">;

/** 乖離判定したい明細行（商品ID＋固定済み見積単価・円）。 */
export type UnitPriceDivergenceInput = {
  productId: string;
  /** 見積に固定された見積単価（円・major units）。 */
  fixedUnitPrice: number;
};

/**
 * 明細行群の単価乖離・解決不能（→CONTEXT）を判定する共有ヘルパー（#593）。
 *
 * 各行の固定済み見積単価と、見積年月日を参照日に現在マスタで再解決した値（→{@link TryResolveSellingPriceQuery}）
 * を突合する。参照日・宛先・得意先/納品先はヘッダ不変属性のため、解決キーは「提出区分×商品ID」で
 * デデュープし、同一商品の複数行は1回だけ解決する（#597 の `duplicatedUnitPriceKey` と同形）。
 *
 * 差額は「再解決値 − 固定値」（符号つき）で、プラスは現在マスタの方が高いことを表す。判定は表示のたびに
 * 実行される派生状態で、乖離の解消（再解決）は行わない（可視化に徹する・ADR-20260710-fg7）。
 *
 * @returns `inputs` と同順・同数の判定結果。
 */
export async function resolveUnitPriceDivergences(
  inputs: readonly UnitPriceDivergenceInput[],
  context: LinePriceContext,
  resolver: UnitPriceDivergenceResolver
): Promise<UnitPriceDivergence[]> {
  // 提出区分は context 内で単一なので、商品IDでデデュープすれば「提出区分×商品ID」キーになる。
  const uniqueProductIds = [...new Set(inputs.map((input) => input.productId))];

  const outcomeByProductId = new Map<string, Awaited<ReturnType<typeof resolver.execute>>>();
  await Promise.all(
    uniqueProductIds.map(async (productId) => {
      const outcome = await resolver.execute(toSellingPriceTarget(productId, context));
      outcomeByProductId.set(productId, outcome);
    })
  );

  return inputs.map((input) => {
    // 解決集合に入れた商品なので必ず索引に存在する。
    const outcome = outcomeByProductId.get(input.productId)!;
    if (outcome.kind === "UNRESOLVABLE") {
      return { kind: "UNRESOLVABLE" };
    }
    const currentUnitPrice = outcome.unitPrice.majorUnits;
    if (currentUnitPrice === input.fixedUnitPrice) {
      return { kind: "NONE" };
    }
    return {
      kind: "DIVERGENT",
      currentUnitPrice,
      difference: currentUnitPrice - input.fixedUnitPrice,
    };
  });
}
