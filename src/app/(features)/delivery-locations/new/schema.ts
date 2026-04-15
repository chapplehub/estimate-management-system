import { z } from "zod";
import { deliveryLocationBaseSchema, deliveryLocationCodeSchema } from "../_shared/schema";

/**
 * 納品先作成フォームのバリデーションスキーマ
 * 基盤スキーマ + code + customerId
 */
export const createDeliveryLocationSchema = deliveryLocationBaseSchema.extend({
  code: deliveryLocationCodeSchema,
  customerId: z.string({ error: "必須入力です" }).min(1, { error: "得意先を選択してください" }),
});

export type CreateDeliveryLocationFormInput = z.infer<typeof createDeliveryLocationSchema>;
