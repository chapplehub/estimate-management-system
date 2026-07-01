"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { revalidatePath } from "next/cache";
import { deleteCommonSellingPricePeriodCommandFactory } from "@subdomains/pricing/application/factories/deleteCommonSellingPricePeriodCommandFactory";
import { editCommonSellingPricePeriodCommandFactory } from "@subdomains/pricing/application/factories/editCommonSellingPricePeriodCommandFactory";
import { endDateCommonSellingPricePeriodCommandFactory } from "@subdomains/pricing/application/factories/endDateCommonSellingPricePeriodCommandFactory";
import { registerCommonSellingPricePeriodCommandFactory } from "@subdomains/pricing/application/factories/registerCommonSellingPricePeriodCommandFactory";
import { reviseCommonSellingPricePeriodCommandFactory } from "@subdomains/pricing/application/factories/reviseCommonSellingPricePeriodCommandFactory";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { handleCommandError } from "../../_shared/error-handler";
import {
  addPeriodSchema,
  deletePeriodSchema,
  endDatePeriodSchema,
  revisePeriodSchema,
  updateFuturePeriodSchema,
} from "./schema";

/**
 * 共通販売単価 適用期間の操作別 Server Action（UC-3/4/5・#473 実BE接続）。
 *
 * いずれも parse → BE コマンド → catch → revalidate の薄いガワ。不変条件（開始日 ≥ 今日・重複禁止・
 * 状態別権限）と楽観ロックは集約／コマンドが既存エラー型で throw し、`handleCommandError` が本番同形に
 * ユーザ向け文言へ変換する。成功時は redirect せず、詳細＋一覧の両パスを revalidate して詳細に留まる。
 * クライアント（PeriodForm）は submission の success を検知してパネルを閉じる。
 *
 * 宛先キー `productId`（コマンド宛先）と `productCode`（route／revalidate 用）は編集読みモデルが返した値を
 * `.bind()` で渡す（フォーム改竄で別商品を操作できないようにする・#473）。価格は10進文字列で運ぶ
 * （ADR-0022）。参照日は各 action でサーバー生成して注入する（ADR-20260627-86b）。
 */

/** 成功後に詳細＋一覧の両パスを再検証する（一覧の現在有効単価・ステータスも動くため）。 */
function revalidateBoth(productCode: string): void {
  revalidatePath(`/common-selling-prices/${productCode}`);
  revalidatePath("/common-selling-prices");
}

/** UC-3 適用期間の登録（未設定商品への初回登録は version 省略＝新規作成）。 */
export async function addPeriodAction(
  productId: string,
  productCode: string,
  _prevState: unknown,
  formData: FormData
) {
  await verifyAdmin();

  const submission = parseWithZod(formData, { schema: addPeriodSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { version, startDate, endDate, price } = submission.value;

  try {
    await registerCommonSellingPricePeriodCommandFactory().execute({
      productId,
      start: startDate,
      end: endDate ?? null,
      price: String(price),
      referenceDate: toJstCalendarDay(new Date()),
      expectedVersion: version,
    });
    revalidateBoth(productCode);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/** UC-4 将来開始行の全項目編集。 */
export async function updateFuturePeriodAction(
  productId: string,
  productCode: string,
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
    await editCommonSellingPricePeriodCommandFactory().execute({
      productId,
      periodId,
      start: startDate,
      end: endDate ?? null,
      price: String(price),
      referenceDate: toJstCalendarDay(new Date()),
      expectedVersion: version,
    });
    revalidateBoth(productCode);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/** UC-4 適用終了(現在有効行に終了日を設定)。 */
export async function endDatePeriodAction(
  productId: string,
  productCode: string,
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
    await endDateCommonSellingPricePeriodCommandFactory().execute({
      productId,
      periodId,
      endDate,
      referenceDate: toJstCalendarDay(new Date()),
      expectedVersion: version,
    });
    revalidateBoth(productCode);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/**
 * 単価改定（ガイド付き・#474）。現在有効行の適用終了（終了日＝改定日）＋改定日開始の新規追加を
 * BE 単一コマンドが1ロード/1セーブで合成しアトミックに適用する。対象の現在有効行はコマンドが
 * 参照日で特定するため periodId は送らない（決定2）。据え置き（新単価＝現単価）も許容する。
 */
export async function revisePeriodAction(
  productId: string,
  productCode: string,
  _prevState: unknown,
  formData: FormData
) {
  await verifyAdmin();

  const submission = parseWithZod(formData, { schema: revisePeriodSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { version, revisionDate, price } = submission.value;

  try {
    await reviseCommonSellingPricePeriodCommandFactory().execute({
      productId,
      revisionDate,
      price: String(price),
      referenceDate: toJstCalendarDay(new Date()),
      expectedVersion: version,
    });
    revalidateBoth(productCode);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/** UC-5 未適用(将来開始)行の削除。 */
export async function deletePeriodAction(
  productId: string,
  productCode: string,
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
    await deleteCommonSellingPricePeriodCommandFactory().execute({
      productId,
      periodId,
      referenceDate: toJstCalendarDay(new Date()),
      expectedVersion: version,
    });
    revalidateBoth(productCode);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}
