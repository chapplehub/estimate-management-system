"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { createCustomerCommandFactory } from "@subdomains/customer/application/factories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { createCustomerSchema } from "./schema";

export async function createCustomer(prevState: unknown, formData: FormData) {
  await verifyAdmin();

  const submission = parseWithZod(formData, {
    schema: createCustomerSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const {
    code,
    name,
    postalCode,
    prefecture,
    address,
    phoneNumber,
    faxNumber,
    contactPerson,
    marginRate,
  } = submission.value;

  try {
    const command = createCustomerCommandFactory();
    await command.execute({
      code,
      name,
      postalCode: postalCode || undefined,
      prefecture: prefecture || undefined,
      address: address || undefined,
      phoneNumber: phoneNumber || undefined,
      faxNumber: faxNumber || undefined,
      contactPerson: contactPerson || undefined,
      marginRate: marginRate ?? undefined,
    });

    revalidatePath("/customers");
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  redirect(`/customers?reason=${REDIRECT_REASON.CUSTOMER_CREATED}`);
}
