import { z } from "zod";
import { departmentBaseSchema } from "../_shared/schema";

/**
 * 部署更新フォームのバリデーションスキーマ
 * 基盤スキーマ + isActive（departmentCdはURLパラメータから取得）
 */
export const updateDepartmentSchema = departmentBaseSchema.extend({
  isActive: z.coerce.boolean(),
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
