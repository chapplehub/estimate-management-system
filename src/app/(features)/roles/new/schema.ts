import { z } from "zod";
import { roleBaseSchema, roleCdSchema } from "../_shared/schema";

/**
 * 役割作成用スキーマ
 * 基盤スキーマに roleCd と positionId を追加
 */
export const createRoleSchema = roleBaseSchema.extend({
  roleCd: roleCdSchema,
  positionId: z
    .string({ error: "役職を選択してください" })
    .min(1, { error: "役職を選択してください" }),
});
