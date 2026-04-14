"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import type { ActionResult } from "@shared/types/ActionResult";
import {
  deleteCustomerCommandFactory,
  getCustomerByCodeQueryFactory,
  updateCustomerCommandFactory,
} from "@subdomains/customer/application/factories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { updateCustomerSchema } from "./schema";

// ========================================
// 得意先更新
// ========================================
export async function updateCustomer(code: string, prevState: unknown, formData: FormData) {
  await verifyAdmin();

  const submission = parseWithZod(formData, {
    schema: updateCustomerSchema,
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
    marginRate,
  } = submission.value;

  // codeからidを取得
  const query = getCustomerByCodeQueryFactory();
  const customer = await query.execute({ code });
  if (!customer) {
    return submission.reply({
      formErrors: ["得意先が見つかりません"],
    });
  }

  try {
    const command = updateCustomerCommandFactory();
    await command.execute({
      id: customer.id,
      name,
      postalCode: postalCode || null,
      prefecture: prefecture || null,
      address: address || null,
      phoneNumber: phoneNumber || null,
      faxNumber: faxNumber || null,
      contactPerson: contactPerson || null,
      marginRate: marginRate,
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${code}`);
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  redirect(`/customers/${code}?reason=${REDIRECT_REASON.CUSTOMER_UPDATED}`);
}

// ========================================
// 得意先削除
// ========================================
export async function deleteCustomer(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await verifyAdmin();

  const id = formData.get("id") as string;

  try {
    const command = deleteCustomerCommandFactory();
    await command.execute({ id });

    revalidatePath("/customers");
  } catch (error) {
    return handleCommandError(error);
  }

  redirect(`/customers?reason=${REDIRECT_REASON.CUSTOMER_DELETED}`);
}
