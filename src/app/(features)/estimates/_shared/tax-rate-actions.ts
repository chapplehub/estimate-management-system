"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { resolveEffectiveTaxRateQueryFactory } from "@subdomains/estimate/application/factories/estimateQueryFactory";
import { fromDateInputValue } from "./date";

/**
 * 見積年月日（"yyyy-mm-dd"）に有効な消費税率をライブ解決する Server Action（C1 作成画面）。
 *
 * 作成中はまだ税率が確定しないため、見積年月日の変更に追従してマスタから有効税率を引き、
 * ヘッダーの read-only 表示と明細プレビューの税率に供給する（編集画面と同じ `findEffectiveAt`）。
 * 日付は JST 固定でパースし、UTC 解釈による暦日ずれ（§8.7 era 誤判定）を避ける。該当税率が
 * 無い場合は `null` を返し、UI で「税率未設定」を扱う。確定値は submit 時に §8.7 で再確定する。
 */
export async function resolveEffectiveTaxRate(estimateDate: string): Promise<number | null> {
  await verifySession();

  if (!estimateDate) {
    return null;
  }

  return await resolveEffectiveTaxRateQueryFactory().execute({
    date: fromDateInputValue(estimateDate),
  });
}
