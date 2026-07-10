import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import {
  type SellingPriceResolutionTarget,
  type ResolveSellingPriceQuery,
} from "@subdomains/pricing/application/queries/ResolveSellingPriceQuery";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { describe, expect, it, vi } from "vitest";
import {
  resolveUnitPricesOrReject,
  type UnitPriceResolutionRequest,
} from "../resolveUnitPricesOrReject";

/**
 * productId → 円 のマップから解決するフェイクの価格決定。未登録商品は解決不能として
 * BusinessRuleViolationError を投げる（本物の PriceResolutionPolicy と同じ振る舞い）。
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

/** 得意先宛ターゲットを組み立てる小道具。 */
function customerRequest(
  key: string,
  productId: string,
  productName: string
): UnitPriceResolutionRequest {
  return {
    key,
    productName,
    target: {
      addressee: "CUSTOMER",
      customerId: "cust-1",
      productId,
      estimateDate: new Date("2026-08-01T00:00:00+09:00"),
    },
  };
}

describe("resolveUnitPricesOrReject", () => {
  it("全件解決できるとき: キー → Money のマップを返す", async () => {
    const { resolver } = fakeResolver({ "prod-a": 1000, "prod-b": 2000 });

    const resolved = await resolveUnitPricesOrReject(
      [
        customerRequest("CUSTOMER:prod-a", "prod-a", "商品A"),
        customerRequest("CUSTOMER:prod-b", "prod-b", "商品B"),
      ],
      resolver
    );

    expect(resolved.get("CUSTOMER:prod-a")?.majorUnits).toBe(1000);
    expect(resolved.get("CUSTOMER:prod-b")?.majorUnits).toBe(2000);
  });

  it("同一キーは解決呼び出しを1回にデデュープする", async () => {
    const { resolver, execute } = fakeResolver({ "prod-a": 1000 });

    const resolved = await resolveUnitPricesOrReject(
      [
        customerRequest("CUSTOMER:prod-a", "prod-a", "商品A"),
        customerRequest("CUSTOMER:prod-a", "prod-a", "商品A"),
      ],
      resolver
    );

    expect(resolved.get("CUSTOMER:prod-a")?.majorUnits).toBe(1000);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("解決不能が混在するとき: 全ての未設定商品を商品名で列挙した単一の BusinessRuleViolationError を投げる", async () => {
    const { resolver } = fakeResolver({ "prod-a": 1000 });

    const promise = resolveUnitPricesOrReject(
      [
        customerRequest("CUSTOMER:prod-a", "prod-a", "商品A"),
        customerRequest("CUSTOMER:prod-b", "prod-b", "商品B"),
        customerRequest("CUSTOMER:prod-c", "prod-c", "商品C"),
      ],
      resolver
    );

    await expect(promise).rejects.toBeInstanceOf(BusinessRuleViolationError);
    // 1件ずつではなく、未設定の全商品名を1つの例外に列挙する（設計判断 B）。
    await expect(promise).rejects.toThrow(/商品B/);
    await expect(promise).rejects.toThrow(/商品C/);
  });

  it("同名の未解決商品はエラー列挙で重複させない", async () => {
    const { resolver } = fakeResolver({});

    const error = (await resolveUnitPricesOrReject(
      [
        customerRequest("CUSTOMER:prod-b", "prod-b", "商品B"),
        customerRequest("DELIVERY_LOCATION:prod-b", "prod-b", "商品B"),
      ],
      resolver
    ).catch((e: unknown) => e)) as Error;

    expect((error.message.match(/商品B/g) ?? []).length).toBe(1);
  });

  it("価格決定以外の例外（インフラ障害等）は握り潰さずそのまま伝播する", async () => {
    const execute = vi.fn(async () => {
      throw new TypeError("DB connection lost");
    });

    await expect(
      resolveUnitPricesOrReject([customerRequest("CUSTOMER:prod-a", "prod-a", "商品A")], {
        execute,
      })
    ).rejects.toBeInstanceOf(TypeError);
  });
});
