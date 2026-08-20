import { describe, expect, it, vi } from "vitest";
import { callReadAction, READ_ACTION_FAILED_MESSAGE } from "@/app/_lib/callReadAction";
import { reportError } from "@/app/_lib/report-error";
import { toast } from "sonner";

/**
 * read/query 系 Server Action 呼び出しの共通ラッパーの単体テスト（#633・ADR-20260723-h7r）。
 *
 * 検証範囲は「捕まえた後に何をするか」（成功時の透過・失敗時の `undefined` 返却・
 * `reportError` 全件記録・固定 ID toast）に限る。呼び出し箇所への配線は E2E を足さない方針。
 */

vi.mock("@/app/_lib/report-error", () => ({
  reportError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("callReadAction（read系Server Action呼び出しの共通ラッパー）", () => {
  it("成功時は Action の戻り値をそのまま返す", async () => {
    const result = await callReadAction(
      async () => ["row-1", "row-2"],
      "searchProductsForSelection"
    );

    expect(result).toEqual(["row-1", "row-2"]);
    expect(reportError).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("成功時の null は業務値として透過する（undefined に潰さない）", async () => {
    const result = await callReadAction(async () => null, "resolveEffectiveTaxRate");

    expect(result).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("失敗時は undefined を返す", async () => {
    const result = await callReadAction(async () => {
      throw new Error("boom");
    }, "getProductSuggestions");

    expect(result).toBeUndefined();
  });

  it("失敗時は context 付きで reportError に記録する", async () => {
    const error = new Error("boom");
    await callReadAction(async () => {
      throw error;
    }, "getProductSuggestions");

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(error, "getProductSuggestions");
  });

  it("失敗時は固定文言・固定 ID の toast を出す（重複を1枚に統合するため）", async () => {
    await callReadAction(async () => {
      throw new Error("boom");
    }, "getProductSuggestions");

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(READ_ACTION_FAILED_MESSAGE, {
      id: "read-action-failed",
    });
  });

  it("Error 以外が throw されても undefined を返し記録する", async () => {
    await callReadAction(async () => {
      throw "just a string";
    }, "expandSetComponents");

    expect(reportError).toHaveBeenCalledWith("just a string", "expandSetComponents");
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("並列に失敗しても reportError は全件・toast は同一 ID で発火する", async () => {
    const failing = () =>
      callReadAction(async () => {
        throw new Error("boom");
      }, "resolveSellingPricesForDisplay");

    const results = await Promise.all([failing(), failing(), failing()]);

    expect(results).toEqual([undefined, undefined, undefined]);
    expect(reportError).toHaveBeenCalledTimes(3);
    expect(toast.error).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(toast.error).mock.calls) {
      expect(call[1]).toEqual({ id: "read-action-failed" });
    }
  });
});
