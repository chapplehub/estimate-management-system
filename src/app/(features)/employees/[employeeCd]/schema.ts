import { z } from "zod";
import { employeeBaseSchema } from "../_shared/schema";

/**
 * 従業員更新フォームのバリデーションスキーマ
 * 基盤スキーマのみ（id, employeeCdはURLパラメータから取得）
 */
export const updateEmployeeSchema = employeeBaseSchema;

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
