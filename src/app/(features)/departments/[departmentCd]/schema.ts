import { z } from "zod";
import { departmentBaseSchema } from "../_shared/schema";

/**
 * 部署更新フォームのバリデーションスキーマ
 * 基盤スキーマ + isActive + version（departmentCdはURLパラメータから取得）
 *
 * version は楽観ロックトークン（ADR-0039）。編集画面表示時の値を hidden input で
 * 往復させ、保存時の競合検知に用いる。
 */
export const updateDepartmentSchema = departmentBaseSchema.extend({
  isActive: z.coerce.boolean(),
  version: z.coerce.number(),
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
