import { z } from "zod";

/**
 * バリエーション有効化/無効化トグル（S7 / C5）のバリデーションスキーマ。
 *
 * 状態変更は内容入力を取らない。利用者の入力面は「どのバリエーションか（variationId）」と
 * 楽観ロックトークン（version）の 2 つだけ（C7 得意先改訂と同型）。estimateId は
 * estimateNumber から DTO 解決し、有効化/無効化の区別は呼び出す Server Action で分ける
 * （ADR-0018 でコマンドを分離しているため、向きを示すフィールドは持たない）。
 *
 * - version: 集約ルートの楽観ロックトークン（ADR-0039）。hidden で往復し coerce で数値化。
 * - variationId: 対象バリエーションの同定。
 */
export const variationStatusSchema = z.object({
  version: z.coerce.number().int(),
  variationId: z.string().min(1, "対象バリエーションが特定できません"),
});

export type VariationStatusFormInput = z.infer<typeof variationStatusSchema>;
