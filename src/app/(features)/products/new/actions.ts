"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { createProductCommandFactory } from "@subdomains/product/application/factories/createProductCommandFactory";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { createProductSchema } from "./schema";

export async function createProduct(prevState: unknown, formData: FormData) {
  await verifyAdmin();

  const submission = parseWithZod(formData, {
    schema: createProductSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const { code, name, category, unit, description, note } = submission.value;

  try {
    const command = createProductCommandFactory();
    await command.execute({
      code,
      name,
      category,
      unit,
      description,
      note,
    });

    revalidatePath("/products");
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  redirect(`/products?reason=${REDIRECT_REASON.PRODUCT_CREATED}`);
}
