import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { CommonSellingPricePeriodId } from "../CommonSellingPricePeriodId";

/** テスト用の有効なUUIDv7 */
const VALID_UUID_V7 = "019573a0-7a00-7000-8000-000000000001";

describe("CommonSellingPricePeriodId", () => {
  it("有効なUUIDv7を受け入れる", () => {
    const id = new CommonSellingPricePeriodId(VALID_UUID_V7);
    expect(id.value).toBe(VALID_UUID_V7);
  });

  it("不正な形式を拒否する", () => {
    expect(() => new CommonSellingPricePeriodId("not-a-uuid")).toThrow(ValidationError);
  });

  it("generate() は有効な CommonSellingPricePeriodId を返す", () => {
    const id = CommonSellingPricePeriodId.generate();
    expect(id).toBeInstanceOf(CommonSellingPricePeriodId);
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("generate() は毎回異なるIDを返す", () => {
    expect(CommonSellingPricePeriodId.generate().value).not.toBe(
      CommonSellingPricePeriodId.generate().value
    );
  });
});
