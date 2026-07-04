"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { revalidatePath } from "next/cache";
import { deleteDeliveryLocationSellingPricePeriodCommandFactory } from "@subdomains/pricing/application/factories/deleteDeliveryLocationSellingPricePeriodCommandFactory";
import { editDeliveryLocationSellingPricePeriodCommandFactory } from "@subdomains/pricing/application/factories/editDeliveryLocationSellingPricePeriodCommandFactory";
import { endDateDeliveryLocationSellingPricePeriodCommandFactory } from "@subdomains/pricing/application/factories/endDateDeliveryLocationSellingPricePeriodCommandFactory";
import { registerDeliveryLocationSellingPricePeriodCommandFactory } from "@subdomains/pricing/application/factories/registerDeliveryLocationSellingPricePeriodCommandFactory";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { handleCommandError } from "../../../_shared/error-handler";
import {
  addPeriodSchema,
  deletePeriodSchema,
  endDatePeriodSchema,
  updateFuturePeriodSchema,
} from "./schema";

/**
 * 納品先別販売単価 適用期間の操作別 Server Action（UC-3/4/5・#505 実BE接続）。
 *
 * いずれも parse → BE コマンド → catch → revalidate の薄いガワ。不変条件（開始日 ≥ 今日・重複禁止・
 * 状態別権限）と楽観ロックは集約／コマンドが既存エラー型で throw し、`handleCommandError` が本番同形に
 * ユーザ向け文言へ変換する。成功時は redirect せず、詳細＋一覧の両パスを revalidate して詳細に留まる。
 * クライアント（PeriodForm）は submission の success を検知してパネルを閉じる。
 *
 * 得意先別販売単価（`customer-selling-prices/[customerCd]/[productCd]/actions.ts`）の同型写像で、宛先軸が
 * 得意先から納品先へ替わる点だけが異なる（ADR-20260627-a5c）。宛先キー（コマンド宛先）と
 * `deliveryLocationCode`/`productCode`（route／revalidate 用）は編集読みモデルが返した値を `.bind()` で渡す
 * （フォーム改竄で別の納品先×商品を操作できないようにする）。価格は10進文字列で運ぶ（ADR-0022）。
 * 参照日は各 action でサーバー生成して注入する（ADR-20260627-86b）。
 */

/** 成功後に詳細＋一覧の両パスを再検証する（一覧の現在有効単価・ステータスも動くため）。 */
function revalidateBoth(deliveryLocationCode: string, productCode: string): void {
  revalidatePath(`/delivery-location-selling-prices/${deliveryLocationCode}/${productCode}`);
  revalidatePath("/delivery-location-selling-prices");
}

/** UC-3 適用期間の登録（上書きなし＝集約なしへの初回登録は version 省略＝新規作成）。 */
export async function addPeriodAction(
  deliveryLocationId: string,
  productId: string,
  deliveryLocationCode: string,
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
    await registerDeliveryLocationSellingPricePeriodCommandFactory().execute({
      deliveryLocationId,
      productId,
      start: startDate,
      end: endDate ?? null,
      price: String(price),
      referenceDate: toJstCalendarDay(new Date()),
      expectedVersion: version,
    });
    revalidateBoth(deliveryLocationCode, productCode);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/** UC-4 将来開始行の全項目編集。 */
export async function updateFuturePeriodAction(
  deliveryLocationId: string,
  productId: string,
  deliveryLocationCode: string,
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
    await editDeliveryLocationSellingPricePeriodCommandFactory().execute({
      deliveryLocationId,
      productId,
      periodId,
      start: startDate,
      end: endDate ?? null,
      price: String(price),
      referenceDate: toJstCalendarDay(new Date()),
      expectedVersion: version,
    });
    revalidateBoth(deliveryLocationCode, productCode);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/** UC-4 適用終了(現在有効行に終了日を設定)。 */
export async function endDatePeriodAction(
  deliveryLocationId: string,
  productId: string,
  deliveryLocationCode: string,
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
    await endDateDeliveryLocationSellingPricePeriodCommandFactory().execute({
      deliveryLocationId,
      productId,
      periodId,
      endDate,
      referenceDate: toJstCalendarDay(new Date()),
      expectedVersion: version,
    });
    revalidateBoth(deliveryLocationCode, productCode);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}

/** UC-5 未適用(将来開始)行の削除。 */
export async function deletePeriodAction(
  deliveryLocationId: string,
  productId: string,
  deliveryLocationCode: string,
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
    await deleteDeliveryLocationSellingPricePeriodCommandFactory().execute({
      deliveryLocationId,
      productId,
      periodId,
      referenceDate: toJstCalendarDay(new Date()),
      expectedVersion: version,
    });
    revalidateBoth(deliveryLocationCode, productCode);
  } catch (error) {
    const result = handleCommandError(error);
    const message = !result.success && result.error ? result.error : undefined;
    return submission.reply({ formErrors: message ? [message] : [] });
  }

  return submission.reply();
}
