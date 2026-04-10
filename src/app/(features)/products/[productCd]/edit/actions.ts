"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { updateProductCommandFactory } from "@subdomains/product/application/factories/updateProductCommandFactory";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../../_shared/error-handler";
import { updateProductSchema } from "./schema";

/**
 * 商品更新Server Action
 * @param productCd - URLパラメータから取得した商品コード（bind()で渡す）
 */
export async function updateProduct(productCd: string, prevState: unknown, formData: FormData) {
  await verifyAdmin();

  const submission = parseWithZod(formData, {
    schema: updateProductSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const { code, name, category, unit, description, note, costPrice } = submission.value;

  // productCdからidを取得
  const queryService = new PrismaProductQueryService();
  const product = await queryService.findByCode(productCd);
  if (!product) {
    return submission.reply({
      formErrors: ["商品が見つかりません"],
    });
  }

  const { id } = product;

  try {
    const command = updateProductCommandFactory();
    await command.execute({
      id,
      code,
      name,
      category,
      unit,
      description,
      note,
      costPrice,
    });

    revalidatePath("/products");
    revalidatePath(`/products/${productCd}`);
    if (code !== productCd) {
      revalidatePath(`/products/${code}`);
    }
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  // コード変更時は新コードのURLへリダイレクト
  const redirectCode = code !== productCd ? code : productCd;
  redirect(`/products/${redirectCode}?reason=${REDIRECT_REASON.PRODUCT_UPDATED}`);
}
