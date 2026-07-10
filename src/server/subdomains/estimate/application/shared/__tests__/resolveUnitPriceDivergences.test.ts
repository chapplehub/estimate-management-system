import { Money } from "@server/shared/domain/values/Money";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import type { PriceResolutionOutcome } from "@subdomains/pricing/domain/policies/PriceResolutionPolicy";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { describe, expect, it, vi } from "vitest";
import { resolveUnitPriceDivergences } from "../resolveUnitPriceDivergences";

const resolved = (yen: number): PriceResolutionOutcome => ({
  kind: "RESOLVED",
  unitPrice: SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen)),
});
const UNRESOLVABLE: PriceResolutionOutcome = { kind: "UNRESOLVABLE" };

const customerContext = {
  submissionType: SubmissionType.CUSTOMER,
  customerId: "cus-1",
  deliveryLocationId: "del-1",
  estimateDate: new Date("2025-04-01T00:00:00.000Z"),
};

/** productId → 再解決結果を引く fake resolver（呼び出し回数も観測する）。 */
function fakeResolver(byProduct: Record<string, PriceResolutionOutcome>) {
  return {
    execute: vi.fn(
      async (target: { productId: string }) => byProduct[target.productId] ?? UNRESOLVABLE
    ),
  };
}

describe("resolveUnitPriceDivergences", () => {
  it("固定単価と再解決値が一致すれば NONE（乖離なし）", async () => {
    const resolver = fakeResolver({ "prod-1": resolved(1000) });

    const [divergence] = await resolveUnitPriceDivergences(
      [{ productId: "prod-1", fixedUnitPrice: 1000 }],
      customerContext,
      resolver
    );

    expect(divergence.kind).toBe("NONE");
  });

  it("再解決値が固定単価と異なれば DIVERGENT（現在値と符号つき差額を載せる）", async () => {
    const resolver = fakeResolver({ "prod-1": resolved(1200) });

    const [divergence] = await resolveUnitPriceDivergences(
      [{ productId: "prod-1", fixedUnitPrice: 1000 }],
      customerContext,
      resolver
    );

    expect(divergence).toEqual({ kind: "DIVERGENT", currentUnitPrice: 1200, difference: 200 });
  });

  it("再解決値が固定単価より小さければ差額は負符号", async () => {
    const resolver = fakeResolver({ "prod-1": resolved(700) });

    const [divergence] = await resolveUnitPriceDivergences(
      [{ productId: "prod-1", fixedUnitPrice: 1000 }],
      customerContext,
      resolver
    );

    expect(divergence).toEqual({ kind: "DIVERGENT", currentUnitPrice: 700, difference: -300 });
  });

  it("再解決できなければ UNRESOLVABLE（解決不能）", async () => {
    const resolver = fakeResolver({ "prod-1": UNRESOLVABLE });

    const [divergence] = await resolveUnitPriceDivergences(
      [{ productId: "prod-1", fixedUnitPrice: 1000 }],
      customerContext,
      resolver
    );

    expect(divergence.kind).toBe("UNRESOLVABLE");
  });

  it("同一商品の複数行は1回だけ解決する（提出区分×商品でデデュープ）", async () => {
    const resolver = fakeResolver({ "prod-1": resolved(1200) });

    const divergences = await resolveUnitPriceDivergences(
      [
        { productId: "prod-1", fixedUnitPrice: 1000 },
        { productId: "prod-1", fixedUnitPrice: 1200 },
      ],
      customerContext,
      resolver
    );

    // 解決は商品IDで1回だけ。行ごとに固定単価が違うので乖離結果は行ごとに導出される。
    expect(resolver.execute).toHaveBeenCalledTimes(1);
    expect(divergences[0]).toEqual({ kind: "DIVERGENT", currentUnitPrice: 1200, difference: 200 });
    expect(divergences[1].kind).toBe("NONE");
  });

  it("納品先宛は納品先IDで解決ターゲットを組む（提出区分ルーティング）", async () => {
    const resolver = fakeResolver({ "prod-1": resolved(1000) });

    await resolveUnitPriceDivergences(
      [{ productId: "prod-1", fixedUnitPrice: 1000 }],
      { ...customerContext, submissionType: SubmissionType.DELIVERY_LOCATION },
      resolver
    );

    expect(resolver.execute).toHaveBeenCalledWith(
      expect.objectContaining({ addressee: "DELIVERY_LOCATION", deliveryLocationId: "del-1" })
    );
  });
});
