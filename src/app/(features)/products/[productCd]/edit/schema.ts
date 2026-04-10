import type { z } from "zod";
import { productBaseSchema, productCategorySchema, productCodeSchema } from "../../_shared/schema";

/**
 * 商品更新フォームのバリデーションスキーマ
 * code: 編集可能, category: フォームに含むが変更不可（B011サーバー側検証用）
 */
export const updateProductSchema = productBaseSchema.extend({
  code: productCodeSchema,
  category: productCategorySchema,
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
