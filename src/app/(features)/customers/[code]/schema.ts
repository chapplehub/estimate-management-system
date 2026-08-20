import { z } from "zod";
import { customerBaseSchema } from "../_shared/schema";

/**
 * 得意先更新フォームのバリデーションスキーマ
 * 基盤スキーマ + version（codeはURLパラメータから取得、isActiveは専用アクションで管理）
 *
 * version は楽観ロックトークン（ADR-0039）。編集画面表示時の値を hidden input で
 * 往復させ、保存時の競合検知に用いる。
 */
export const updateCustomerSchema = customerBaseSchema.extend({
  version: z.coerce.number().int(),
});

export type UpdateCustomerFormInput = z.infer<typeof updateCustomerSchema>;
