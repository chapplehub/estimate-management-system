import type { z } from "zod";
import { departmentBaseSchema, departmentCdSchema } from "../_shared/schema";

/**
 * 部署作成フォームのバリデーションスキーマ
 * 基盤スキーマ + departmentCd
 */
export const createDepartmentSchema = departmentBaseSchema.extend({
  departmentCd: departmentCdSchema,
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
