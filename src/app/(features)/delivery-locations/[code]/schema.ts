import { z } from "zod";
import { deliveryLocationBaseSchema } from "../_shared/schema";

/**
 * 納品先編集フォームのバリデーションスキーマ
 * code は URL パラメータから取得するため含まない
 *
 * version は楽観ロックトークン（ADR-0039）。編集画面表示時の値を hidden input で
 * 往復させ、保存時の競合検知に用いる。
 */
export const updateDeliveryLocationSchema = deliveryLocationBaseSchema.extend({
  version: z.coerce.number().int(),
});
