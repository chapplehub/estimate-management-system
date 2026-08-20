import type { z } from "zod";
import { customerBaseSchema, customerCodeSchema } from "../_shared/schema";

/**
 * 得意先作成フォームのバリデーションスキーマ
 * 基盤スキーマ + code
 */
export const createCustomerSchema = customerBaseSchema.extend({
  code: customerCodeSchema,
});

export type CreateCustomerFormInput = z.infer<typeof createCustomerSchema>;
