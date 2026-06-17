import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";
import { createEstimateSchema } from "../schema";

/**
 * C1 作成フォームの createEstimateSchema を conform parseWithZod 経路で固定するテスト。
 *
 * 検証する契約:
 * - 区分別サブタイプ必須（NEW=不要 / REPAIR=修理3項目 / AFTER_REPAIR=事後修理4項目）を superRefine で担保
 * - 空メモは conform が undefined 化しても success（optional 契約・編集側と同じ）
 * - ノード配列が JSON からパースされて value.nodes に載る（ADR-0050・nodesField 共有）
 */

const ONE_LINE_NODE = JSON.stringify([
  {
    kind: "line",
    productId: "p1",
    itemName: "明細",
    unit: "個",
    quantity: 1,
    unitPrice: 1000,
    discountRate: 1,
    itemDiscount: 0,
    customerMemo: "",
    internalMemo: "",
  },
]);

/** ヘッダー共通項目＋初期バリ1件の最小 FormData。overrides で個別フィールドを差し替える。 */
function buildFormData(overrides: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    estimateType: "NEW",
    estimateDate: "2026-06-17",
    deadline: "2026-06-30",
    customerId: "cust-1",
    deliveryLocationId: "loc-1",
    departmentId: "dept-1",
    taxRoundingType: "ROUND_DOWN",
    submissionType: "CUSTOMER",
    overallDiscount: "0",
    customerMemo: "",
    internalMemo: "",
    nodes: ONE_LINE_NODE,
  };
  const merged = { ...base, ...overrides };
  const fd = new FormData();
  for (const [k, v] of Object.entries(merged)) {
    fd.set(k, v);
  }
  return fd;
}

describe("createEstimateSchema の conform parseWithZod 経路", () => {
  it("NEW は修理情報なしで success（空メモも undefined 化に耐える）", () => {
    const submission = parseWithZod(buildFormData(), { schema: createEstimateSchema });

    if (submission.status !== "success") {
      throw new Error(`status=${submission.status} reply=${JSON.stringify(submission.reply())}`);
    }
    expect(submission.value.estimateType).toBe("NEW");
    expect(submission.value.nodes).toHaveLength(1);
  });

  it("REPAIR で修理3項目が空だと、各フィールドパスへエラーが付き失敗する", () => {
    const submission = parseWithZod(buildFormData({ estimateType: "REPAIR" }), {
      schema: createEstimateSchema,
    });

    expect(submission.status).toBe("error");
    const reply = submission.reply();
    expect(reply.error).toHaveProperty("repairTargetProductId");
    expect(reply.error).toHaveProperty("repairFaultDescription");
    expect(reply.error).toHaveProperty("repairScheduledRepairDate");
  });

  it("REPAIR で修理3項目が揃えば success", () => {
    const submission = parseWithZod(
      buildFormData({
        estimateType: "REPAIR",
        repairTargetProductId: "prod-9",
        repairFaultDescription: "異音",
        repairScheduledRepairDate: "2026-07-01",
      }),
      { schema: createEstimateSchema }
    );

    if (submission.status !== "success") {
      throw new Error(`status=${submission.status} reply=${JSON.stringify(submission.reply())}`);
    }
    expect(submission.value.estimateType).toBe("REPAIR");
  });

  it("AFTER_REPAIR で事後修理4項目が空だと失敗する（緊急理由含む）", () => {
    const submission = parseWithZod(buildFormData({ estimateType: "AFTER_REPAIR" }), {
      schema: createEstimateSchema,
    });

    expect(submission.status).toBe("error");
    expect(submission.reply().error).toHaveProperty("afterRepairEmergencyReason");
  });
});
