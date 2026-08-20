import type { z } from "zod";
import { productBaseSchema, productCategorySchema, productCodeSchema } from "../_shared/schema";

/**
 * 商品作成フォームのバリデーションスキーマ
 * 基盤スキーマ + code + category
 */
export const createProductSchema = productBaseSchema.extend({
  code: productCodeSchema,
  category: productCategorySchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
