import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { SellingUnitPrice } from "../../values/SellingUnitPrice";
import { PriceResolutionPolicy } from "../PriceResolutionPolicy";

const price = (yen: number): SellingUnitPrice =>
  SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

describe("PriceResolutionPolicy", () => {
  it("上書きがあれば共通があっても上書きを採用する（先勝ち）", () => {
    const resolved = PriceResolutionPolicy.resolve({
      override: price(800),
      common: price(1000),
      productId: "prod-1",
      addressee: "CUSTOMER",
    });
    expect(resolved.equals(price(800))).toBe(true);
  });

  it("上書きが無ければ共通へフォールバックする", () => {
    const resolved = PriceResolutionPolicy.resolve({
      override: null,
      common: price(1000),
      productId: "prod-1",
      addressee: "DELIVERY_LOCATION",
    });
    expect(resolved.equals(price(1000))).toBe(true);
  });

  it("上書きも共通も無ければ解決不能として BusinessRuleViolationError を投げる", () => {
    expect(() =>
      PriceResolutionPolicy.resolve({
        override: null,
        common: null,
        productId: "prod-1",
        addressee: "CUSTOMER",
      })
    ).toThrow(BusinessRuleViolationError);
  });

  it("解決不能メッセージに productId と提出区分（得意先宛）が含まれる", () => {
    expect(() =>
      PriceResolutionPolicy.resolve({
        override: null,
        common: null,
        productId: "prod-42",
        addressee: "CUSTOMER",
      })
    ).toThrow(/prod-42/);
    expect(() =>
      PriceResolutionPolicy.resolve({
        override: null,
        common: null,
        productId: "prod-42",
        addressee: "CUSTOMER",
      })
    ).toThrow(/得意先宛/);
  });

  it("解決不能メッセージに提出区分（納品先宛）が含まれる", () => {
    expect(() =>
      PriceResolutionPolicy.resolve({
        override: null,
        common: null,
        productId: "prod-7",
        addressee: "DELIVERY_LOCATION",
      })
    ).toThrow(/納品先宛/);
  });
});
