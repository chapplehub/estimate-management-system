import { describe, expect, it } from "vitest";
import { applicablePeriodBounds, dateRangeValue } from "../dateRange";

describe("dateRangeValue", () => {
  it("半開区間 [) の daterange を生成し start/end をパラメータ bind する", () => {
    const sql = dateRangeValue("2025-07-01", "2025-10-01");
    expect(sql.text).toContain("daterange");
    expect(sql.text).toContain("'[)'");
    expect(sql.values).toEqual(["2025-07-01", "2025-10-01"]);
  });

  it("無期限は end=null をそのまま bind する（番兵日付を使わない）", () => {
    const sql = dateRangeValue("2025-07-01", null);
    expect(sql.values).toEqual(["2025-07-01", null]);
  });
});

describe("applicablePeriodBounds", () => {
  it("下端・上端を text へ展開し Row 型のエイリアス（start / end）で返す", () => {
    expect(applicablePeriodBounds.text).toContain("lower(applicable_period)::text AS start");
    expect(applicablePeriodBounds.text).toContain(`upper(applicable_period)::text AS "end"`);
  });
});
