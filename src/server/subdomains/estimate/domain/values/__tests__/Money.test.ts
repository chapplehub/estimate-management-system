import { InvalidArgumentError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Money } from "../Money";

describe("Money", () => {
  describe("正常系", () => {
    it("最小単位（銭）から生成できる", () => {
      const money = Money.fromMinorUnits(10_000_000);
      expect(money.minorUnits).toBe(10_000_000);
      expect(money.majorUnits).toBe(100_000);
    });

    it("主単位（円）から生成できる", () => {
      const money = Money.fromMajorUnits(100_000);
      expect(money.minorUnits).toBe(10_000_000);
    });

    it("銭（小数2桁）を含む主単位から生成できる", () => {
      const money = Money.fromMajorUnits(100.5);
      expect(money.minorUnits).toBe(10_050);
    });

    it("zero は0円を表す", () => {
      expect(Money.zero().minorUnits).toBe(0);
      expect(Money.zero().isZero()).toBe(true);
    });

    it("同額・同通貨は等価である", () => {
      expect(Money.fromMajorUnits(1000).equals(Money.fromMinorUnits(100_000))).toBe(true);
    });

    it("加算できる", () => {
      const result = Money.fromMajorUnits(1000).add(Money.fromMajorUnits(500));
      expect(result.majorUnits).toBe(1500);
    });

    it("減算できる", () => {
      const result = Money.fromMajorUnits(1000).subtract(Money.fromMajorUnits(300));
      expect(result.majorUnits).toBe(700);
    });

    it("減算結果が負になりうる（粗利等で利用）", () => {
      const result = Money.fromMajorUnits(300).subtract(Money.fromMajorUnits(1000));
      expect(result.majorUnits).toBe(-700);
      expect(result.isNegative()).toBe(true);
    });

    it("整数倍できる（数量との乗算）", () => {
      const result = Money.fromMajorUnits(100.5).times(3);
      expect(result.majorUnits).toBe(301.5);
    });

    it("比率を適用できる（掛率0.95 = 9500/10^4、銭未満切捨）", () => {
      // 100,000円 × 0.95 = 95,000円
      const result = Money.fromMajorUnits(100_000).applyRate(9500, 4);
      expect(result.majorUnits).toBe(95_000);
    });

    it("比率適用は浮動小数点誤差なく整数演算される", () => {
      // 286.42円(=28642銭) × 0.95 = 27209.9銭 → 銭未満切捨 → 27209銭 = 272.09円
      const result = Money.fromMinorUnits(28_642).applyRate(9500, 4);
      expect(result.minorUnits).toBe(27_209);
    });

    it("円未満を切り捨てる（端数切捨の単位は円）", () => {
      // 301.50円 → 301円
      const result = Money.fromMajorUnits(301.5).truncateToMajorUnit();
      expect(result.majorUnits).toBe(301);
    });

    it("ちょうど円単位の場合は切り捨てで変化しない", () => {
      const result = Money.fromMajorUnits(301).truncateToMajorUnit();
      expect(result.majorUnits).toBe(301);
    });

    it("円未満を切り上げる", () => {
      expect(Money.fromMajorUnits(100.4).ceilToMajorUnit().majorUnits).toBe(101);
      expect(Money.fromMajorUnits(101).ceilToMajorUnit().majorUnits).toBe(101);
    });

    it("円未満を四捨五入する", () => {
      expect(Money.fromMajorUnits(100.4).roundToMajorUnit().majorUnits).toBe(100);
      expect(Money.fromMajorUnits(100.5).roundToMajorUnit().majorUnits).toBe(101);
    });
  });

  describe("異常系", () => {
    it("最小単位に小数を渡すとエラー", () => {
      expect(() => Money.fromMinorUnits(100.5)).toThrow(InvalidArgumentError);
      expect(() => Money.fromMinorUnits(100.5)).toThrow(
        "金額（最小単位）は整数である必要があります"
      );
    });

    it("通貨のスケールを超える精度（円の小数3桁）はエラー", () => {
      expect(() => Money.fromMajorUnits(100.005)).toThrow(InvalidArgumentError);
      expect(() => Money.fromMajorUnits(100.005)).toThrow(
        "金額はJPYの最小単位（小数2桁）以下の精度では指定できません"
      );
    });

    it("times に小数を渡すとエラー", () => {
      expect(() => Money.fromMajorUnits(100).times(1.5)).toThrow(InvalidArgumentError);
      expect(() => Money.fromMajorUnits(100).times(1.5)).toThrow(
        "Money.times の乗数は整数である必要があります"
      );
    });

    // 異種通貨演算の防止（assertSameCurrency）は Money パターンの不変条件だが、
    // 現状の通貨レジストリは JPY のみのため到達不能。第2の通貨を追加した時点でテストを足す。
  });
});
