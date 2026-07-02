import { describe, expect, it } from "vitest";
import { formatYenFromDecimal } from "./formatYen";

/**
 * 10進文字列→円表示の純関数の挙動固定テスト（#501・共通売単価 _components から昇格した際の回帰防止）。
 * 小数部は意味のある桁（非ゼロ）があるときだけ残す仕様を固定する。
 */
describe("formatYenFromDecimal", () => {
  it("小数部がゼロなら整数として桁区切りで表示する", () => {
    expect(formatYenFromDecimal("1000.00")).toBe("¥1,000");
  });

  it("小数部に意味のある桁があれば末尾ゼロを落として残す", () => {
    expect(formatYenFromDecimal("12.50")).toBe("¥12.5");
  });

  it("整数部は3桁ごとに桁区切りする", () => {
    expect(formatYenFromDecimal("1234567.00")).toBe("¥1,234,567");
  });

  it("負数は符号を保持して桁区切りする", () => {
    expect(formatYenFromDecimal("-1000.00")).toBe("¥-1,000");
  });
});
