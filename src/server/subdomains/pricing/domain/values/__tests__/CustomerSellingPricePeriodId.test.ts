import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { CustomerSellingPricePeriodId } from "../CustomerSellingPricePeriodId";

/** テスト用の有効なUUIDv7 */
const VALID_UUID_V7 = "019573a0-7a00-7000-8000-000000000001";

describe("CustomerSellingPricePeriodId", () => {
  it("有効なUUIDv7を受け入れる", () => {
    const id = new CustomerSellingPricePeriodId(VALID_UUID_V7);
    expect(id.value).toBe(VALID_UUID_V7);
  });

  it("不正な形式を拒否する", () => {
    expect(() => new CustomerSellingPricePeriodId("not-a-uuid")).toThrow(ValidationError);
  });

  it("generate() は有効な CustomerSellingPricePeriodId を返す", () => {
    const id = CustomerSellingPricePeriodId.generate();
    expect(id).toBeInstanceOf(CustomerSellingPricePeriodId);
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("generate() は毎回異なるIDを返す", () => {
    expect(CustomerSellingPricePeriodId.generate().value).not.toBe(
      CustomerSellingPricePeriodId.generate().value
    );
  });
});
