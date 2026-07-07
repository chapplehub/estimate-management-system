import { describe, it, expect } from "vitest";
import { VariationApplicationState } from "@subdomains/estimate/domain/values/approval/VariationApplicationState";
import { selectApplicationRows, type ReducedApplicationRow } from "../selectApplicationRows";

/** テスト用の還元済み行を最小指定で組み立てる（未指定は無害な既定値）。 */
function row(overrides: Partial<ReducedApplicationRow> = {}): ReducedApplicationRow {
  return {
    variationId: overrides.variationId ?? "v-default",
    estimateNumber: "N0000001",
    variationNumber: 1,
    customerName: "得意先",
    deliveryLocationName: "納品先",
    submissionType: "NORMAL",
    finalTotal: 1000,
    state: VariationApplicationState.PENDING,
    awaitingRoleId: null,
    awaitingRoleName: null,
    applicantName: "申請 太郎",
    appliedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("selectApplicationRows", () => {
  it("フィルタ無しなら申請日時降順で並べて返す", () => {
    const older = row({ variationId: "old", appliedAt: new Date("2026-01-01T00:00:00Z") });
    const newer = row({ variationId: "new", appliedAt: new Date("2026-03-01T00:00:00Z") });

    const result = selectApplicationRows([older, newer], {});

    expect(result.map((r) => r.variationId)).toEqual(["new", "old"]);
  });

  it("申請日時が同一なら見積番号昇順、さらに同一ならバリエーション番号昇順で安定化する", () => {
    const at = new Date("2026-02-01T00:00:00Z");
    const a = row({
      variationId: "a",
      estimateNumber: "N0000002",
      variationNumber: 1,
      appliedAt: at,
    });
    const b = row({
      variationId: "b",
      estimateNumber: "N0000001",
      variationNumber: 2,
      appliedAt: at,
    });
    const c = row({
      variationId: "c",
      estimateNumber: "N0000001",
      variationNumber: 1,
      appliedAt: at,
    });

    const result = selectApplicationRows([a, b, c], {});

    // N0000001 が先（昇順）。その中では variationNumber 1 → 2。最後に N0000002。
    expect(result.map((r) => r.variationId)).toEqual(["c", "b", "a"]);
  });

  it("state 指定時は指定 code のいずれかに一致する行だけ残す（フィールド内 OR）", () => {
    const pending = row({ variationId: "p", state: VariationApplicationState.PENDING });
    const rejected = row({ variationId: "r", state: VariationApplicationState.REJECTED });
    const approved = row({ variationId: "a", state: VariationApplicationState.APPROVED });

    const result = selectApplicationRows([pending, rejected, approved], {
      state: ["PENDING", "APPROVED"],
    });

    expect(result.map((r) => r.variationId).sort()).toEqual(["a", "p"]);
  });

  it("applicantName は部分一致（大文字小文字無視）で絞る", () => {
    const taro = row({ variationId: "t", applicantName: "山田 太郎" });
    const hanako = row({ variationId: "h", applicantName: "鈴木 花子" });
    const smith = row({ variationId: "s", applicantName: "John SMITH" });

    expect(
      selectApplicationRows([taro, hanako, smith], { applicantName: "太郎" }).map(
        (r) => r.variationId
      )
    ).toEqual(["t"]);
    // 大文字小文字を無視する。
    expect(
      selectApplicationRows([taro, hanako, smith], { applicantName: "smith" }).map(
        (r) => r.variationId
      )
    ).toEqual(["s"]);
  });

  it("awaitingRoleId は roleId 等値で絞り、承認待ち役割を持たない行(null)はヒットしない", () => {
    const pendingMatch = row({
      variationId: "match",
      state: VariationApplicationState.PENDING,
      awaitingRoleId: "role-1",
      awaitingRoleName: "部長",
    });
    const pendingOther = row({
      variationId: "other",
      state: VariationApplicationState.PENDING,
      awaitingRoleId: "role-2",
      awaitingRoleName: "課長",
    });
    // 承認済は承認待ち役割を持たない（null）。
    const approved = row({
      variationId: "approved",
      state: VariationApplicationState.APPROVED,
      awaitingRoleId: null,
      awaitingRoleName: null,
    });

    const result = selectApplicationRows([pendingMatch, pendingOther, approved], {
      awaitingRoleId: "role-1",
    });

    expect(result.map((r) => r.variationId)).toEqual(["match"]);
  });

  it("appliedFrom/appliedTo で申請日時の範囲を境界含みで絞る", () => {
    const jan = row({ variationId: "jan", appliedAt: new Date("2026-01-15T00:00:00Z") });
    const feb = row({ variationId: "feb", appliedAt: new Date("2026-02-15T00:00:00Z") });
    const mar = row({ variationId: "mar", appliedAt: new Date("2026-03-15T00:00:00Z") });
    const all = [jan, feb, mar];

    // 下限のみ（feb の日時ちょうどを境界に含む）。
    expect(
      selectApplicationRows(all, { appliedFrom: new Date("2026-02-15T00:00:00Z") }).map(
        (r) => r.variationId
      )
    ).toEqual(["mar", "feb"]);
    // 上限のみ（feb の日時ちょうどを境界に含む）。
    expect(
      selectApplicationRows(all, { appliedTo: new Date("2026-02-15T00:00:00Z") }).map(
        (r) => r.variationId
      )
    ).toEqual(["feb", "jan"]);
    // from≤to の範囲（feb のみ）。
    expect(
      selectApplicationRows(all, {
        appliedFrom: new Date("2026-02-01T00:00:00Z"),
        appliedTo: new Date("2026-02-28T00:00:00Z"),
      }).map((r) => r.variationId)
    ).toEqual(["feb"]);
  });

  it("limit はフィルタ・ソート後に先頭から切り出す", () => {
    const jan = row({ variationId: "jan", appliedAt: new Date("2026-01-01T00:00:00Z") });
    const feb = row({ variationId: "feb", appliedAt: new Date("2026-02-01T00:00:00Z") });
    const mar = row({ variationId: "mar", appliedAt: new Date("2026-03-01T00:00:00Z") });

    // 申請日時降順で mar, feb, jan。limit=2 で先頭 2 件。
    const result = selectApplicationRows([jan, feb, mar], {}, 2);

    expect(result.map((r) => r.variationId)).toEqual(["mar", "feb"]);
  });

  it("矛盾する組合せ（状態=承認済 かつ 承認待ち役割指定）は AND で空を返す", () => {
    const approved = row({
      variationId: "approved",
      state: VariationApplicationState.APPROVED,
      awaitingRoleId: null,
      awaitingRoleName: null,
    });

    const result = selectApplicationRows([approved], {
      state: ["APPROVED"],
      awaitingRoleId: "role-1",
    });

    expect(result).toEqual([]);
  });

  it("複数フィールドはフィールド間 AND で全て満たす行だけ残す", () => {
    const hit = row({
      variationId: "hit",
      state: VariationApplicationState.PENDING,
      applicantName: "山田 太郎",
      appliedAt: new Date("2026-02-15T00:00:00Z"),
    });
    // 状態は一致するが申請者名が外れる。
    const wrongName = row({
      variationId: "wrongName",
      state: VariationApplicationState.PENDING,
      applicantName: "鈴木 花子",
      appliedAt: new Date("2026-02-15T00:00:00Z"),
    });
    // 申請者名は一致するが日時が範囲外。
    const wrongDate = row({
      variationId: "wrongDate",
      state: VariationApplicationState.PENDING,
      applicantName: "山田 太郎",
      appliedAt: new Date("2026-05-15T00:00:00Z"),
    });

    const result = selectApplicationRows([hit, wrongName, wrongDate], {
      state: ["PENDING"],
      applicantName: "太郎",
      appliedFrom: new Date("2026-02-01T00:00:00Z"),
      appliedTo: new Date("2026-02-28T00:00:00Z"),
    });

    expect(result.map((r) => r.variationId)).toEqual(["hit"]);
  });
});
