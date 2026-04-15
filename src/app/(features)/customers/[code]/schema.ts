import type { z } from "zod";
import { customerBaseSchema } from "../_shared/schema";

/**
 * 得意先更新フォームのバリデーションスキーマ
 * 基盤スキーマのみ（codeはURLパラメータから取得、isActiveは専用アクションで管理）
 */
export const updateCustomerSchema = customerBaseSchema;

export type UpdateCustomerFormInput = z.infer<typeof updateCustomerSchema>;
