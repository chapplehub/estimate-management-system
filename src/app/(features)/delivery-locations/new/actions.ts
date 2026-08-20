"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { createDeliveryLocationCommandFactory } from "@subdomains/delivery-location/application/factories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { createDeliveryLocationSchema } from "./schema";

export async function createDeliveryLocation(prevState: unknown, formData: FormData) {
  await verifySession();

  const submission = parseWithZod(formData, {
    schema: createDeliveryLocationSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const {
    code,
    name,
    customerId,
    postalCode,
    prefecture,
    address,
    phoneNumber,
    faxNumber,
    contactPerson,
    deliveryNotes,
  } = submission.value;

  try {
    const command = createDeliveryLocationCommandFactory();
    await command.execute({
      code,
      name,
      customerId,
      postalCode: postalCode || undefined,
      prefecture: prefecture || undefined,
      address: address || undefined,
      phoneNumber: phoneNumber || undefined,
      faxNumber: faxNumber || undefined,
      contactPerson: contactPerson || undefined,
      deliveryNotes: deliveryNotes || undefined,
    });

    revalidatePath("/delivery-locations");
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  redirect(`/delivery-locations?reason=${REDIRECT_REASON.DELIVERY_LOCATION_CREATED}`);
}
