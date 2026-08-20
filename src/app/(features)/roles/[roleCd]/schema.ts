import { z } from "zod";
import { roleBaseSchema } from "../_shared/schema";

/**
 * 役割更新用スキーマ
 * roleCd, positionId は不変のため含まない。
 *
 * version は楽観ロックトークン（ADR-0039）。編集画面表示時の値を hidden input で
 * 往復させ、更新コマンドへ素通しして競合を検知する。フォームからは文字列で届くため
 * coerce で数値化する。version は新規作成（insert 経路）には不要なため共通の
 * roleBaseSchema には載せず、更新スキーマにのみ追加する。
 */
export const updateRoleSchema = roleBaseSchema.extend({
  version: z.coerce.number().int(),
});
