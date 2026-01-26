import { z } from "zod";
import { employeeBaseSchema } from "../_shared/schema";

/**
 * 従業員更新フォームのバリデーションスキーマ
 * 基盤スキーマ + departmentId（id, employeeCdはURLパラメータから取得）
 */
export const updateEmployeeSchema = employeeBaseSchema.extend({
  departmentId: z.string().min(1, "部署を選択してください"),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
