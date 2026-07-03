"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { createProductCommandFactory } from "@subdomains/product/application/factories/createProductCommandFactory";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
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

  // 価格を持ちうる区分（個別/消耗品）は常に単価未設定で作成されるため、設定を促す INFO トーストへ分岐（#487）。
  // セット商品はそれ自体が単価を持たないので従来どおり成功トースト。区分→canHavePrice の判定はドメイン値
  // オブジェクトに委ね、presentation 層に業務判断を持ち込まない（判断3）。
  const reason = ProductCategory.from(category).canHavePrice()
    ? REDIRECT_REASON.PRODUCT_CREATED_PRICE_UNSET
    : REDIRECT_REASON.PRODUCT_CREATED;

  redirect(`/products?reason=${reason}`);
}
