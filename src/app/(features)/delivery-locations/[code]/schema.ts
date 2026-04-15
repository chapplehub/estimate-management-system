import { deliveryLocationBaseSchema } from "../_shared/schema";

/**
 * 納品先編集フォームのバリデーションスキーマ
 * code は URL パラメータから取得するため含まない
 */
export const updateDeliveryLocationSchema = deliveryLocationBaseSchema;
