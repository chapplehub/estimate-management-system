import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { CostPricePeriodId } from "../CostPricePeriodId";

/** テスト用の有効なUUIDv7 */
const VALID_UUID_V7 = "019573a0-7a00-7000-8000-000000000001";

describe("CostPricePeriodId", () => {
  it("有効なUUIDv7を受け入れる", () => {
    const id = new CostPricePeriodId(VALID_UUID_V7);
    expect(id.value).toBe(VALID_UUID_V7);
  });

  it("不正な形式を拒否する", () => {
    expect(() => new CostPricePeriodId("not-a-uuid")).toThrow(ValidationError);
  });

  it("generate() は有効な CostPricePeriodId を返す", () => {
    const id = CostPricePeriodId.generate();
    expect(id).toBeInstanceOf(CostPricePeriodId);
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("generate() は毎回異なるIDを返す", () => {
    expect(CostPricePeriodId.generate().value).not.toBe(CostPricePeriodId.generate().value);
  });
});
