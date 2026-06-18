import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";
import { duplicateEstimateSchema } from "../duplicateSchema";

/**
 * 見積複製フォームの duplicateEstimateSchema を conform parseWithZod 経路で固定するテスト。
 *
 * 検証する契約（C6 / ADR-0057）:
 * - selectedVariationIds はチェックボックス群（同名複数 append）で配列化し ≥1 必須（ADR-0042）
 * - 見積日・締切日は "yyyy-mm-dd" のまま受ける（dateInput 共有。Server Action で JST 固定パース）
 * - departmentId 必須
 * - version / taxRate は持たない（新規採番のため楽観ロック不要・税率は見積日からマスタ導出）
 */

/** バリ選択（複数 append）＋ヘッダ3項目の最小 FormData。 */
function buildFormData(
  selectedVariationIds: string[],
  overrides: Record<string, string> = {}
): FormData {
  const base: Record<string, string> = {
    estimateDate: "2026-06-17",
    deadline: "2026-06-30",
    departmentId: "dept-1",
  };
  const merged = { ...base, ...overrides };
  const fd = new FormData();
  for (const [k, v] of Object.entries(merged)) {
    fd.set(k, v);
  }
  for (const id of selectedVariationIds) {
    fd.append("selectedVariationIds", id);
  }
  return fd;
}

describe("duplicateEstimateSchema の conform parseWithZod 経路", () => {
  it("バリを1件以上選択しヘッダ3項目が揃えば success（選択は配列化される）", () => {
    const submission = parseWithZod(buildFormData(["var-1", "var-2"]), {
      schema: duplicateEstimateSchema,
    });

    if (submission.status !== "success") {
      throw new Error(`status=${submission.status} reply=${JSON.stringify(submission.reply())}`);
    }
    expect(submission.value.selectedVariationIds).toEqual(["var-1", "var-2"]);
    expect(submission.value.estimateDate).toBe("2026-06-17");
    expect(submission.value.departmentId).toBe("dept-1");
  });

  it("バリを1件も選択しないと selectedVariationIds へエラーが付き失敗する（ADR-0042）", () => {
    const submission = parseWithZod(buildFormData([]), { schema: duplicateEstimateSchema });

    expect(submission.status).toBe("error");
    expect(submission.reply().error).toHaveProperty("selectedVariationIds");
  });

  it("部署未選択だと departmentId へエラーが付き失敗する", () => {
    const submission = parseWithZod(buildFormData(["var-1"], { departmentId: "" }), {
      schema: duplicateEstimateSchema,
    });

    expect(submission.status).toBe("error");
    expect(submission.reply().error).toHaveProperty("departmentId");
  });
});
