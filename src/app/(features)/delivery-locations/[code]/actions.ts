"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import type { ActionResult } from "@shared/types/ActionResult";
import {
  activateDeliveryLocationCommandFactory,
  deactivateDeliveryLocationCommandFactory,
  deleteDeliveryLocationCommandFactory,
  getDeliveryLocationByCodeQueryFactory,
  updateDeliveryLocationCommandFactory,
} from "@subdomains/delivery-location/application/factories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { updateDeliveryLocationSchema } from "./schema";

// ========================================
// 納品先更新
// ========================================
export async function updateDeliveryLocation(code: string, prevState: unknown, formData: FormData) {
  await verifySession();

  const submission = parseWithZod(formData, {
    schema: updateDeliveryLocationSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const {
    name,
    postalCode,
    prefecture,
    address,
    phoneNumber,
    faxNumber,
    contactPerson,
    deliveryNotes,
  } = submission.value;

  // codeからidを取得
  const query = getDeliveryLocationByCodeQueryFactory();
  const deliveryLocation = await query.execute({ code });
  if (!deliveryLocation) {
    return submission.reply({
      formErrors: ["納品先が見つかりません"],
    });
  }

  try {
    const command = updateDeliveryLocationCommandFactory();
    await command.execute({
      id: deliveryLocation.id,
      name,
      postalCode: postalCode || null,
      prefecture: prefecture || null,
      address: address || null,
      phoneNumber: phoneNumber || null,
      faxNumber: faxNumber || null,
      contactPerson: contactPerson || null,
      deliveryNotes: deliveryNotes || null,
    });

    revalidatePath("/delivery-locations");
    revalidatePath(`/delivery-locations/${code}`);
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  redirect(`/delivery-locations/${code}?reason=${REDIRECT_REASON.DELIVERY_LOCATION_UPDATED}`);
}

// ========================================
// 納品先削除
// ========================================
export async function deleteDeliveryLocation(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await verifySession();

  const id = formData.get("id") as string;

  try {
    const command = deleteDeliveryLocationCommandFactory();
    await command.execute({ id });

    revalidatePath("/delivery-locations");
  } catch (error) {
    return handleCommandError(error);
  }

  redirect(`/delivery-locations?reason=${REDIRECT_REASON.DELIVERY_LOCATION_DELETED}`);
}

// ========================================
// 納品先有効化
// ========================================
export async function activateDeliveryLocation(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await verifySession();

  const id = formData.get("id") as string;
  const code = formData.get("code") as string;

  try {
    const command = activateDeliveryLocationCommandFactory();
    await command.execute({ id });

    revalidatePath("/delivery-locations");
    revalidatePath(`/delivery-locations/${code}`);
  } catch (error) {
    return handleCommandError(error);
  }

  redirect(`/delivery-locations/${code}?reason=${REDIRECT_REASON.DELIVERY_LOCATION_ACTIVATED}`);
}

// ========================================
// 納品先無効化
// ========================================
export async function deactivateDeliveryLocation(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await verifySession();

  const id = formData.get("id") as string;
  const code = formData.get("code") as string;

  try {
    const command = deactivateDeliveryLocationCommandFactory();
    await command.execute({ id });

    revalidatePath("/delivery-locations");
    revalidatePath(`/delivery-locations/${code}`);
  } catch (error) {
    return handleCommandError(error);
  }

  redirect(`/delivery-locations/${code}?reason=${REDIRECT_REASON.DELIVERY_LOCATION_DEACTIVATED}`);
}
