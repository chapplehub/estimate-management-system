import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";
import { updateVariationContentSchema } from "./variationSchema";

/**
 * conform の parseWithZod 経路の回帰テスト。
 *
 * conform は空フォームフィールドを `undefined` に変換する（piped 配列内の z.string() にも適用される）。
 * メモを required（z.string()）にすると空メモが「expected string, received undefined」で失敗するため、
 * メモは optional でなければならない。safeParse 直叩きでは再現せず conform 経路でのみ顕在化するので、
 * 本テストで実フォーム送信（空メモ）を模した FormData を parseWithZod に通して契約を固定する。
 */
function buildFormData(linesJson: string): FormData {
  const fd = new FormData();
  fd.set("version", "1");
  fd.set("variationId", "var-1");
  fd.set("lines", linesJson);
  fd.set("overallDiscount", "0");
  // メモは空（conform が undefined 化する経路を踏ませる）。
  fd.set("customerMemo", "");
  fd.set("internalMemo", "");
  return fd;
}

const LINES_WITH_EMPTY_MEMOS = JSON.stringify([
  {
    productId: "p1",
    itemName: "編集対象明細",
    unit: "個",
    quantity: 1,
    unitPrice: 1000,
    discountRate: 1,
    itemDiscount: 0,
    customerMemo: "",
    internalMemo: "",
  },
  {
    productId: "p1",
    itemName: "追加明細",
    unit: "UNIT",
    quantity: 1,
    unitPrice: 0,
    discountRate: 1,
    itemDiscount: 0,
    customerMemo: "",
    internalMemo: "",
  },
]);

describe("updateVariationContentSchema の conform parseWithZod 経路", () => {
  it("空メモを含む送信でも success になる（conform の空→undefined 変換に耐える）", () => {
    const submission = parseWithZod(buildFormData(LINES_WITH_EMPTY_MEMOS), {
      schema: updateVariationContentSchema,
    });

    // 失敗時は理由を露出させる（メモ required 化のリグレッションを検知）。
    if (submission.status !== "success") {
      throw new Error(`status=${submission.status} reply=${JSON.stringify(submission.reply())}`);
    }
    expect(submission.status).toBe("success");
    expect(submission.value.lines).toHaveLength(2);
  });
});
