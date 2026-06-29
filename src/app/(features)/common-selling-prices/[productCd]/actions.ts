"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { revalidatePath } from "next/cache";
import { handleCommandError } from "../../_shared/error-handler";
import {
  addPeriod,
  deletePeriod,
  endDateCurrentPeriod,
  updateFuturePeriod,
} from "../_data/mock-store";
import {
  addPeriodSchema,
  deletePeriodSchema,
  endDatePeriodSchema,
  updateFuturePeriodSchema,
} from "./schema";

/**
 * 共通売単価 適用期間の操作別 Server Action（UC-3/4/5）。
 *
 * いずれも parse → ミューテータ → catch → revalidate の薄いガワ（ラウンド2決定1）。
 * 不変条件・楽観ロックは mock-store ミューテータが既存エラー型で throw し、
 * `handleCommandError` が本番同形にユーザ向け文言へ変換する。
 * 成功時は redirect せず、詳細＋一覧の両パスを revalidate して詳細に留まる（決定8）。
 * クライアント（PeriodForm）は submission の success を検知してパネルを閉じる。
 *
 * productCd は URL から `.bind()` で渡す（フォーム改竄で別商品を操作できないようにする）。
 */

/** 成功後に詳細＋一覧の両パスを再検証する（一覧の現在有効単価・ステータスも動くため）。 */
function revalidateBoth(productCd: string): void {
  revalidatePath(`/common-selling-prices/${productCd}`);
  revalidatePath("/common-selling-prices");
}

/** UC-3 適用期間の登録。 */
export async function addPeriodAction(productCd: string, _prevState: unknown, formData: FormData) {
  await verifyAdmin();

  const submission = parseWithZod(formData, { schema: addPeriodSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { version, startDate, endDate, price } = submission.value;

  try {
    await addPeriod(productCd, version, { startDate, endDate: endDate ?? null, price });
    revalidateBoth(productCd);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/** UC-4 将来開始行の全項目編集。 */
export async function updateFuturePeriodAction(
  productCd: string,
  _prevState: unknown,
  formData: FormData
) {
  await verifyAdmin();

  const submission = parseWithZod(formData, { schema: updateFuturePeriodSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { version, periodId, startDate, endDate, price } = submission.value;

  try {
    await updateFuturePeriod(productCd, version, {
      periodId,
      startDate,
      endDate: endDate ?? null,
      price,
    });
    revalidateBoth(productCd);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/** UC-4 適用終了（現在有効行に終了日を設定）。 */
export async function endDatePeriodAction(
  productCd: string,
  _prevState: unknown,
  formData: FormData
) {
  await verifyAdmin();

  const submission = parseWithZod(formData, { schema: endDatePeriodSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { version, periodId, endDate } = submission.value;

  try {
    await endDateCurrentPeriod(productCd, version, { periodId, endDate });
    revalidateBoth(productCd);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/** UC-5 未適用（将来開始）行の削除。 */
export async function deletePeriodAction(
  productCd: string,
  _prevState: unknown,
  formData: FormData
) {
  await verifyAdmin();

  const submission = parseWithZod(formData, { schema: deletePeriodSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { version, periodId } = submission.value;

  try {
    await deletePeriod(productCd, version, { periodId });
    revalidateBoth(productCd);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}
