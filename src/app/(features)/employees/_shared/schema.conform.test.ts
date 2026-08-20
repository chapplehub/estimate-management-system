import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";
import { USER_ROLES } from "@server/shared/auth/types";
import { employeeBaseSchema } from "./schema";

/**
 * employeeBaseSchema の roleId（担当役割）を conform parseWithZod 経路で固定するテスト。
 *
 * 検証する契約（#568）:
 * - roleId は任意選択。有効値を選べば submission.value.roleId に保存される
 * - 空選択（空文字）は conform が undefined 化する（[[conform-empty-string-to-undefined]]）。
 *   これが BE の「roleId 未指定＝担当役割の解除」意味論と一致する
 * - roleId を送らなくても他フィールドが揃えば success（任意フィールド）
 */

/** name/email/role の必須3項目を満たす最小 FormData（roleId は overrides で付与）。 */
function buildFormData(overrides: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    name: "山田太郎",
    email: "yamada@example.com",
    role: USER_ROLES.USER,
  };
  const merged = { ...base, ...overrides };
  const fd = new FormData();
  for (const [k, v] of Object.entries(merged)) {
    fd.set(k, v);
  }
  return fd;
}

describe("employeeBaseSchema の roleId（conform parseWithZod 経路）", () => {
  it("担当役割を選ぶと submission.value.roleId に保存される", () => {
    const submission = parseWithZod(buildFormData({ roleId: "role-1" }), {
      schema: employeeBaseSchema,
    });

    if (submission.status !== "success") {
      throw new Error(`status=${submission.status} reply=${JSON.stringify(submission.reply())}`);
    }
    expect(submission.value.roleId).toBe("role-1");
  });

  it("担当役割を空選択（空文字）にすると undefined になる（＝解除の意味論）", () => {
    const submission = parseWithZod(buildFormData({ roleId: "" }), {
      schema: employeeBaseSchema,
    });

    if (submission.status !== "success") {
      throw new Error(`status=${submission.status} reply=${JSON.stringify(submission.reply())}`);
    }
    expect(submission.value.roleId).toBeUndefined();
  });

  it("roleId を送らなくても他フィールドが揃えば success（任意フィールド）", () => {
    const submission = parseWithZod(buildFormData(), {
      schema: employeeBaseSchema,
    });

    if (submission.status !== "success") {
      throw new Error(`status=${submission.status} reply=${JSON.stringify(submission.reply())}`);
    }
    expect(submission.value.roleId).toBeUndefined();
  });
});
