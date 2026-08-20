import { describe, expect, it } from "vitest";
import { reviseForCustomerSchema } from "./reviseForCustomerSchema";

describe("reviseForCustomerSchema（得意先改訂・C7）", () => {
  function parse(overrides: Record<string, unknown> = {}) {
    return reviseForCustomerSchema.safeParse({
      version: "1",
      sourceVariationId: "v1",
      ...overrides,
    });
  }

  it("version と sourceVariationId だけの有効入力を通す（tracer bullet）", () => {
    expect(parse().success).toBe(true);
  });

  it("FormData 由来の version 文字列を数値へ強制する（楽観ロックトークン・ADR-0039）", () => {
    const result = parse({ version: "7" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(7);
    }
  });

  it("sourceVariationId 空を拒否する（改訂元の同定必須・回帰ガード）", () => {
    expect(parse({ sourceVariationId: "" }).success).toBe(false);
  });
});
