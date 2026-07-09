import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import {
  type SellingPriceResolutionTarget,
  type ResolveSellingPriceQuery,
} from "@subdomains/pricing/application/queries/ResolveSellingPriceQuery";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { describe, expect, it, vi } from "vitest";
import {
  resolveLinePrices,
  resolveLineTreePrices,
  type ExistingLinePrice,
  type LinePriceContext,
} from "../resolveLinePrices";

/**
 * productId → 円 のマップから解決するフェイクの価格決定。未登録商品は解決不能として
 * BusinessRuleViolationError を投げる（本物の Policy と同じ振る舞い）。
 */
function fakeResolver(prices: Record<string, number>): {
  resolver: Pick<ResolveSellingPriceQuery, "execute">;
  execute: ReturnType<typeof vi.fn>;
} {
  const execute = vi.fn(async (target: SellingPriceResolutionTarget) => {
    const yen = prices[target.productId];
    if (yen === undefined) {
      throw new BusinessRuleViolationError(`販売単価が未設定です: ${target.productId}`);
    }
    return SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
  });
  return { resolver: { execute }, execute };
}

const customerContext: LinePriceContext = {
  submissionType: SubmissionType.CUSTOMER,
  customerId: "cust-1",
  deliveryLocationId: "dl-1",
  estimateDate: new Date("2026-08-01T00:00:00+09:00"),
};

describe("resolveLinePrices", () => {
  it("得意先宛: 各行の商品を得意先ターゲットで解決し、解決済み Money を行順で返す", async () => {
    const { resolver, execute } = fakeResolver({ "prod-a": 1000, "prod-b": 2000 });

    const resolved = await resolveLinePrices(
      [{ productId: "prod-a" }, { productId: "prod-b" }],
      customerContext,
      resolver
    );

    expect(resolved.map((m) => m.majorUnits)).toEqual([1000, 2000]);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        addressee: "CUSTOMER",
        customerId: "cust-1",
        productId: "prod-a",
        estimateDate: customerContext.estimateDate,
      })
    );
  });

  it("納品先宛: 納品先ターゲットへルーティングして解決する", async () => {
    const { resolver, execute } = fakeResolver({ "prod-a": 1500 });

    const resolved = await resolveLinePrices(
      [{ productId: "prod-a" }],
      {
        submissionType: SubmissionType.DELIVERY_LOCATION,
        customerId: "cust-1",
        deliveryLocationId: "dl-9",
        estimateDate: customerContext.estimateDate,
      },
      resolver
    );

    expect(resolved[0].majorUnits).toBe(1500);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        addressee: "DELIVERY_LOCATION",
        deliveryLocationId: "dl-9",
        productId: "prod-a",
      })
    );
  });

  it("同一商品の複数行は解決呼び出しを1回にデデュープし、各行へ同値を返す", async () => {
    const { resolver, execute } = fakeResolver({ "prod-a": 1000 });

    const resolved = await resolveLinePrices(
      [{ productId: "prod-a" }, { productId: "prod-a" }, { productId: "prod-a" }],
      customerContext,
      resolver
    );

    expect(resolved.map((m) => m.majorUnits)).toEqual([1000, 1000, 1000]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("C4 既存行保全: itemId 一致かつ productId 不変の行は永続値を保全し、価格決定を呼ばない", async () => {
    const { resolver, execute } = fakeResolver({ "prod-a": 9999 });
    const existing = new Map<string, ExistingLinePrice>([
      ["item-1", { productId: "prod-a", unitPrice: Money.fromMajorUnits(1000) }],
    ]);

    const resolved = await resolveLinePrices(
      [{ productId: "prod-a", itemId: "item-1" }],
      customerContext,
      resolver,
      existing
    );

    // マスタ現在値（9999）ではなく永続値（1000）を保持する。
    expect(resolved[0].majorUnits).toBe(1000);
    expect(execute).not.toHaveBeenCalled();
  });

  it("C4 商品変更行: itemId は一致しても productId が変われば再解決する", async () => {
    const { resolver, execute } = fakeResolver({ "prod-b": 2000 });
    const existing = new Map<string, ExistingLinePrice>([
      ["item-1", { productId: "prod-a", unitPrice: Money.fromMajorUnits(1000) }],
    ]);

    const resolved = await resolveLinePrices(
      [{ productId: "prod-b", itemId: "item-1" }],
      customerContext,
      resolver,
      existing
    );

    expect(resolved[0].majorUnits).toBe(2000);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("不一致・偽造 itemId は新規行扱いで再解決する（安全側）", async () => {
    const { resolver, execute } = fakeResolver({ "prod-a": 3000 });
    const existing = new Map<string, ExistingLinePrice>([
      ["item-1", { productId: "prod-a", unitPrice: Money.fromMajorUnits(1000) }],
    ]);

    const resolved = await resolveLinePrices(
      [{ productId: "prod-a", itemId: "forged-item" }],
      customerContext,
      resolver,
      existing
    );

    expect(resolved[0].majorUnits).toBe(3000);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("解決不能: resolver の BusinessRuleViolationError をそのまま伝播する", async () => {
    const { resolver } = fakeResolver({ "prod-a": 1000 });

    await expect(
      resolveLinePrices([{ productId: "unpriced" }], customerContext, resolver)
    ).rejects.toThrow(BusinessRuleViolationError);
  });
});

describe("resolveLineTreePrices", () => {
  it("通常明細とセット構成明細の両方を解決し、行オブジェクト参照で Money を引ける", async () => {
    const { resolver } = fakeResolver({ "prod-a": 1000, "prod-b": 2000, "prod-c": 3000 });
    const itemA = { productId: "prod-a" };
    const componentB = { productId: "prod-b" };
    const componentC = { productId: "prod-c" };
    const tree = {
      items: [itemA],
      setGroups: [{ components: [componentB, componentC] }],
    };

    const priceMap = await resolveLineTreePrices(tree, customerContext, resolver);

    expect(priceMap.get(itemA)?.majorUnits).toBe(1000);
    expect(priceMap.get(componentB)?.majorUnits).toBe(2000);
    expect(priceMap.get(componentC)?.majorUnits).toBe(3000);
  });

  it("既存行保全はネストしたセット構成明細にも効く（itemId 一致・productId 不変）", async () => {
    const { resolver, execute } = fakeResolver({ "prod-b": 9999 });
    const component = { productId: "prod-b", itemId: "item-2" };
    const tree = { items: [], setGroups: [{ components: [component] }] };
    const existing = new Map<string, ExistingLinePrice>([
      ["item-2", { productId: "prod-b", unitPrice: Money.fromMajorUnits(2000) }],
    ]);

    const priceMap = await resolveLineTreePrices(tree, customerContext, resolver, existing);

    expect(priceMap.get(component)?.majorUnits).toBe(2000);
    expect(execute).not.toHaveBeenCalled();
  });
});
