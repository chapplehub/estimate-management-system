import { z } from "zod";

/**
 * 共通売単価 適用期間の操作別バリデーションスキーマ（UC-3/4/5）。
 *
 * 単項目の形（必須・実在日・整数・非負）と、同一フォーム内で完結する交差検証
 * （終了>開始）のみをここで担保する。集約横断の重複・状態別権限・楽観ロック競合・
 * 適用終了の「本日以降」は mock-store ミューテータ（＝ドメインのスタンドイン）が
 * 最終判定する（ラウンド2決定1/6）。操作別に分けることで、現在有効行の開始日・単価を
 * 入力契約から外し改竄不能にする（決定3）。
 */

/** `YYYY-MM-DD` かつ実在する暦日（2026-02-30 や 2026-13-01 を弾く）。 */
const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    // Date.UTC で構築し UTC 成分で突合（タイムゾーンによる暦日ずれを避ける）。
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, "存在しない日付です");

/** 共通売単価（0以上の整数。マスタ正規入力として0円を許容＝use-cases.md ルール3）。 */
const priceInput = z.coerce
  .number({ message: "単価を入力してください" })
  .int("単価は整数で入力してください")
  .min(0, "単価は0円以上で入力してください");

/** 楽観ロックトークン（ADR-0039）。表示時の version を hidden で往復させる。 */
const versionInput = z.coerce.number().int();

/** 開始日に対し終了日が後（厳密）であること。終了日 未指定（無期限）は許容。 */
function endAfterStart(value: { startDate: string; endDate?: string }): boolean {
  return value.endDate == null || value.startDate < value.endDate;
}
const END_AFTER_START_ISSUE = {
  message: "適用終了日は適用開始日より後にしてください",
  path: ["endDate"],
};

/** UC-3 登録: 開始日（必須）・終了日（任意・無期限可）・単価。 */
export const addPeriodSchema = z
  .object({
    version: versionInput,
    startDate: dateInput,
    // conform は空文字を undefined 化するため任意は optional にする（無期限＝終了日なし）。
    endDate: dateInput.optional(),
    price: priceInput,
  })
  .refine(endAfterStart, END_AFTER_START_ISSUE);

/** UC-4 将来行の全項目編集: 対象 periodId ＋ 開始日・終了日・単価。 */
export const updateFuturePeriodSchema = z
  .object({
    version: versionInput,
    periodId: z.string().min(1),
    startDate: dateInput,
    endDate: dateInput.optional(),
    price: priceInput,
  })
  .refine(endAfterStart, END_AFTER_START_ISSUE);

/**
 * UC-4 適用終了（end-dating）: 対象 periodId ＋ 終了日（必須）。
 * 開始日・単価は入力契約に含めない（現在有効行のロック項目＝改竄不能）。
 * 終了>開始（厳密）・本日以降はミューテータがストア上の真の開始日で最終判定する。
 */
export const endDatePeriodSchema = z.object({
  version: versionInput,
  periodId: z.string().min(1),
  endDate: dateInput,
});

/** UC-5 削除: 対象 periodId のみ（＋楽観ロック version）。 */
export const deletePeriodSchema = z.object({
  version: versionInput,
  periodId: z.string().min(1),
});

export type AddPeriodFormInput = z.infer<typeof addPeriodSchema>;
export type UpdateFuturePeriodFormInput = z.infer<typeof updateFuturePeriodSchema>;
export type EndDatePeriodFormInput = z.infer<typeof endDatePeriodSchema>;
export type DeletePeriodFormInput = z.infer<typeof deletePeriodSchema>;
