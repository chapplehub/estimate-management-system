import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { Money } from "@server/shared/domain/values/Money";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSellingPricesForDisplay } from "../selling-price-actions";

/**
 * 表示用の販売単価ライブ解決 Server Action（#430・Step 6）の配線契約テスト。
 *
 * 実 Prisma には触れず、Composition Root（pricing factory）とセッションをモックして
 * 「バッチ解決・商品IDデデュープ・宛先マッピング・解決不能の null 化（throw しない）」を固定する。
 * 保存経路（resolveLinePrices）は解決不能を throw で伝播するが、表示用は throw せず null にする——
 * この責務の非対称が本アクションの核心。
 */

const verifySession = vi.fn();
vi.mock("@/app/_lib/verifyAuthentication", () => ({
  verifySession: () => verifySession(),
}));

const resolveExecute = vi.fn();
vi.mock("@subdomains/pricing/application/factories/pricingQueryFactory", () => ({
  resolveSellingPriceQueryFactory: () => ({ execute: resolveExecute }),
}));

function priceOf(yen: number): SellingUnitPrice {
  return SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
}

beforeEach(() => {
  vi.clearAllMocks();
  verifySession.mockResolvedValue({ user: { employeeId: "emp-001" } });
});

describe("resolveSellingPricesForDisplay", () => {
  it("得意先宛の商品単価を解決し productId→円 のマップで返す", async () => {
    resolveExecute.mockResolvedValue(priceOf(1500));

    const result = await resolveSellingPricesForDisplay({
      estimateDate: "2026-07-09",
      addressee: "CUSTOMER",
      addresseeId: "cust-001",
      productIds: ["prod-A"],
    });

    expect(verifySession).toHaveBeenCalledOnce();
    expect(resolveExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        addressee: "CUSTOMER",
        customerId: "cust-001",
        productId: "prod-A",
        estimateDate: expect.any(Date),
      })
    );
    expect(result).toEqual({ "prod-A": 1500 });
  });

  it("解決不能（BusinessRuleViolationError）は throw せず null を返す", async () => {
    resolveExecute.mockRejectedValue(
      new BusinessRuleViolationError("販売単価が設定されていません")
    );

    const result = await resolveSellingPricesForDisplay({
      estimateDate: "2026-07-09",
      addressee: "CUSTOMER",
      addresseeId: "cust-001",
      productIds: ["prod-X"],
    });

    expect(result).toEqual({ "prod-X": null });
  });

  it("納品先宛は deliveryLocationId でマッピングする", async () => {
    resolveExecute.mockResolvedValue(priceOf(800));

    await resolveSellingPricesForDisplay({
      estimateDate: "2026-07-09",
      addressee: "DELIVERY_LOCATION",
      addresseeId: "dloc-001",
      productIds: ["prod-A"],
    });

    expect(resolveExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        addressee: "DELIVERY_LOCATION",
        deliveryLocationId: "dloc-001",
        productId: "prod-A",
      })
    );
  });

  it("同一商品IDはデデュープし1回だけ解決する", async () => {
    resolveExecute.mockResolvedValue(priceOf(1200));

    const result = await resolveSellingPricesForDisplay({
      estimateDate: "2026-07-09",
      addressee: "CUSTOMER",
      addresseeId: "cust-001",
      productIds: ["prod-A", "prod-A", "prod-A"],
    });

    expect(resolveExecute).toHaveBeenCalledOnce();
    expect(result).toEqual({ "prod-A": 1200 });
  });

  it("複数商品を並列解決し、解決可否が混在してもそれぞれ正しく返す", async () => {
    resolveExecute.mockImplementation((target) => {
      if (target.productId === "prod-B") {
        return Promise.reject(new BusinessRuleViolationError("未設定"));
      }
      return Promise.resolve(priceOf(500));
    });

    const result = await resolveSellingPricesForDisplay({
      estimateDate: "2026-07-09",
      addressee: "CUSTOMER",
      addresseeId: "cust-001",
      productIds: ["prod-A", "prod-B"],
    });

    expect(result).toEqual({ "prod-A": 500, "prod-B": null });
  });

  it("BusinessRuleViolationError 以外の例外は握り潰さず伝播する", async () => {
    resolveExecute.mockRejectedValue(new Error("DB接続断"));

    await expect(
      resolveSellingPricesForDisplay({
        estimateDate: "2026-07-09",
        addressee: "CUSTOMER",
        addresseeId: "cust-001",
        productIds: ["prod-A"],
      })
    ).rejects.toThrow("DB接続断");
  });

  it("商品IDが空なら resolver を呼ばず空マップを返す", async () => {
    const result = await resolveSellingPricesForDisplay({
      estimateDate: "2026-07-09",
      addressee: "CUSTOMER",
      addresseeId: "cust-001",
      productIds: [],
    });

    expect(resolveExecute).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("見積年月日が空なら resolver を呼ばず空マップを返す", async () => {
    const result = await resolveSellingPricesForDisplay({
      estimateDate: "",
      addressee: "CUSTOMER",
      addresseeId: "cust-001",
      productIds: ["prod-A"],
    });

    expect(resolveExecute).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("未認証ならセッション検証で throw する（resolver に到達しない）", async () => {
    verifySession.mockRejectedValue(new Error("unauthorized"));

    await expect(
      resolveSellingPricesForDisplay({
        estimateDate: "2026-07-09",
        addressee: "CUSTOMER",
        addresseeId: "cust-001",
        productIds: ["prod-A"],
      })
    ).rejects.toThrow("unauthorized");
    expect(resolveExecute).not.toHaveBeenCalled();
  });
});
