import { z } from "zod";
import { productBaseSchema, productCategorySchema, productCodeSchema } from "../../_shared/schema";

/**
 * 商品更新フォームのバリデーションスキーマ
 * code: 編集可能, category: フォームに含むが変更不可（B011サーバー側検証用）
 * version は楽観ロックトークン（ADR-0039）。編集画面表示時の値を hidden input で往復させる
 */
export const updateProductSchema = productBaseSchema.extend({
  code: productCodeSchema,
  category: productCategorySchema,
  version: z.coerce.number().int(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
