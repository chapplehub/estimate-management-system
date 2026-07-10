import { z } from "zod";

/**
 * 得意先改訂フォーム（C7 / ReviseForCustomer）のバリデーションスキーマ。
 *
 * 改訂はドメイン `Estimate.reviseForCustomer(sourceVariationId, resolvedUnitPrices)` が改訂先の内容を
 * 決定する（内容入力を一切取らない・Estimate.ts）。掛率・値引・メモ・全体値引は改訂元から複写し、
 * 見積単価のみ得意先宛で再解決する（#431。アプリ層が価格決定した結果を引数で渡す）。よって利用者の
 * 入力面は「どの改訂元を改訂するか（sourceVariationId）」と楽観ロックトークン（version）の 2 つだけで、
 * C3/C6 のような明細・日付・部署の入力は持たない（スキーマ・写像・金額プレビュー不要）。
 *
 * - version: 集約ルートの楽観ロックトークン（ADR-0039）。hidden で往復し coerce で数値化（C2/C4 と同型）。
 * - sourceVariationId: 改訂元バリエーションの同定。estimateId は estimateNumber から DTO 解決する。
 */
export const reviseForCustomerSchema = z.object({
  version: z.coerce.number().int(),
  sourceVariationId: z.string().min(1, "改訂元バリエーションが特定できません"),
});

export type ReviseForCustomerFormInput = z.infer<typeof reviseForCustomerSchema>;
