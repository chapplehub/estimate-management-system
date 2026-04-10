"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import type { ActionResult } from "@shared/types/ActionResult";
import { activateProductCommandFactory } from "@subdomains/product/application/factories/activateProductCommandFactory";
import { deactivateProductCommandFactory } from "@subdomains/product/application/factories/deactivateProductCommandFactory";
import { deleteProductCommandFactory } from "@subdomains/product/application/factories/deleteProductCommandFactory";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";

// ========================================
// 商品削除
// ========================================
export async function deleteProduct(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await verifyAdmin();

  const id = formData.get("id") as string;

  try {
    const command = deleteProductCommandFactory();
    await command.execute({ id });

    revalidatePath("/products");
  } catch (error) {
    return handleCommandError(error);
  }

  redirect(`/products?reason=${REDIRECT_REASON.PRODUCT_DELETED}`);
}

// ========================================
// 商品有効化
// ========================================
export async function activateProduct(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await verifyAdmin();

  const id = formData.get("id") as string;
  const productCd = formData.get("productCd") as string;

  try {
    const command = activateProductCommandFactory();
    await command.execute({ id });

    revalidatePath("/products");
    revalidatePath(`/products/${productCd}`);
  } catch (error) {
    return handleCommandError(error);
  }

  redirect(`/products/${productCd}?reason=${REDIRECT_REASON.PRODUCT_ACTIVATED}`);
}

// ========================================
// 商品無効化
// ========================================
export async function deactivateProduct(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await verifyAdmin();

  const id = formData.get("id") as string;
  const productCd = formData.get("productCd") as string;

  try {
    const command = deactivateProductCommandFactory();
    await command.execute({ id });

    revalidatePath("/products");
    revalidatePath(`/products/${productCd}`);
  } catch (error) {
    return handleCommandError(error);
  }

  redirect(`/products/${productCd}?reason=${REDIRECT_REASON.PRODUCT_DEACTIVATED}`);
}
