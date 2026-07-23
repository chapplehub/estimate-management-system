import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportError } from "@/app/_lib/report-error";

describe("reportError（例外ログの単一接続点シーム）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("context と error を console.error に渡す", () => {
    const error = new Error("boom");
    reportError(error, "features-boundary");

    expect(console.error).toHaveBeenCalledTimes(1);
    const [message, payload] = vi.mocked(console.error).mock.calls[0];
    expect(message).toContain("features-boundary");
    expect(payload).toMatchObject({ error });
  });

  // 境界以外（read 系ラッパー callReadAction）からも呼ばれるため接頭辞は境界名を含まない（#633）。
  it("ログ接頭辞は境界に限定しない [report-error]", () => {
    reportError(new Error("boom"), "getProductSuggestions");

    const [message] = vi.mocked(console.error).mock.calls[0];
    expect(message).toContain("[report-error]");
  });

  it("error に digest があれば相関 ID として渡す", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    reportError(error, "global-error");

    const [, payload] = vi.mocked(console.error).mock.calls[0];
    expect(payload).toMatchObject({ digest: "abc123", error });
  });

  it("digest を持たない値でも例外を投げず context を残す", () => {
    reportError("just a string", "features-boundary");

    expect(console.error).toHaveBeenCalledTimes(1);
    const [message, payload] = vi.mocked(console.error).mock.calls[0];
    expect(message).toContain("features-boundary");
    expect(payload).toMatchObject({ digest: undefined, error: "just a string" });
  });
});
