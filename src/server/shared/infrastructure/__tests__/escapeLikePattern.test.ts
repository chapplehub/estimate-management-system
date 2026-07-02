import { describe, expect, it } from "vitest";
import { containsPattern, escapeLikePattern } from "../escapeLikePattern";

describe("escapeLikePattern", () => {
  it("% を \\% にエスケープしてリテラル化する", () => {
    expect(escapeLikePattern("50%")).toBe("50\\%");
  });

  it("_ を \\_ にエスケープしてリテラル化する", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("エスケープ文字 \\ 自身も \\\\ にエスケープする", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("\\ と _ が混在しても各文字を独立にエスケープする（二重エスケープしない）", () => {
    expect(escapeLikePattern("a\\_b")).toBe("a\\\\\\_b");
  });

  it("メタ文字を含まない入力はそのまま返す", () => {
    expect(escapeLikePattern("PROD-001")).toBe("PROD-001");
  });
});

describe("containsPattern", () => {
  it("エスケープ済み本体を前後 % で囲んだ部分一致パターンを返す", () => {
    expect(containsPattern("50%")).toBe("%50\\%%");
  });

  it("メタ文字を含まない入力も前後 % で囲む", () => {
    expect(containsPattern("PROD")).toBe("%PROD%");
  });
});
