import { z } from "zod";
import { employeeBaseSchema } from "../_shared/schema";

/**
 * 従業員更新フォームのバリデーションスキーマ
 * 基盤スキーマ + departmentId（id, employeeCdはURLパラメータから取得）
 * version は楽観ロックトークン（ADR-0039）。編集画面表示時の値を hidden input で往復させる
 */
export const updateEmployeeSchema = employeeBaseSchema.extend({
  departmentId: z.string().min(1, "部署を選択してください"),
  version: z.coerce.number().int(),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
