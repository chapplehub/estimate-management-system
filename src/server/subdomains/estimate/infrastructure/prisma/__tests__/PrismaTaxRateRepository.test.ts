import { describe, expect, it } from "vitest";
import { PrismaTaxRateRepository } from "../PrismaTaxRateRepository";

/**
 * 本テストはシードの消費税率マスタ（史実2行）を前提とする:
 *   2014-04-01 00:00 JST → 0.080 (8%)
 *   2019-10-01 00:00 JST → 0.100 (10%)
 * これは日本の消費税の史実であり任意のフィクスチャではないため、
 * テスト内で行を INSERT せず（単調タイムライン不変条件を歪めないため）シードをそのまま使う。
 * シードを変更する場合は本テストの期待値も見直すこと。
 */
describe("PrismaTaxRateRepository.findEffectiveAt", () => {
  const repository = new PrismaTaxRateRepository();

  it("最新行の effectiveFrom より後の日時は最新税率(0.100)を返す", async () => {
    const result = await repository.findEffectiveAt(new Date("2020-01-01T00:00:00+09:00"));

    expect(result).not.toBeNull();
    expect(result?.rate.value).toBe(0.1);
  });

  it("effectiveFrom と同日時は その行の税率(0.080)を返す（境界は等値を含む）", async () => {
    const result = await repository.findEffectiveAt(new Date("2014-04-01T00:00:00+09:00"));

    expect(result).not.toBeNull();
    expect(result?.rate.value).toBe(0.08);
  });

  it("2行の中間日時は 前の行の税率(0.080)を返す", async () => {
    const result = await repository.findEffectiveAt(new Date("2018-01-01T00:00:00+09:00"));

    expect(result).not.toBeNull();
    expect(result?.rate.value).toBe(0.08);
  });

  it("最古行の effectiveFrom より前の日時は null を返す", async () => {
    const result = await repository.findEffectiveAt(new Date("2013-01-01T00:00:00+09:00"));

    expect(result).toBeNull();
  });
});
