"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import type { ActionResult } from "@shared/types/ActionResult";
import { activateProductCommandFactory } from "@subdomains/product/application/factories/activateProductCommandFactory";
import { deactivateProductCommandFactory } from "@subdomains/product/application/factories/deactivateProductCommandFactory";
import { deactivateProductWithReplacementCommandFactory } from "@subdomains/product/application/factories/deactivateProductWithReplacementCommandFactory";
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
  // 楽観ロックトークン（ADR-0039）: 画面表示時の version。Zod は使わず
  // deactivateWithReplacement と同じ手動ガードで不正値（改ざん等）を弾く。
  const versionRaw = formData.get("version");
  const expectedVersion = Number(versionRaw);
  if (typeof versionRaw !== "string" || !Number.isInteger(expectedVersion)) {
    return { success: false, error: "不正なリクエストです" };
  }

  try {
    const command = deleteProductCommandFactory();
    await command.execute({ id, expectedVersion });

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

  // 楽観ロックトークン（ADR-0039）: 画面表示時の version
  const versionRaw = formData.get("version");
  const version = Number(versionRaw);
  if (typeof versionRaw !== "string" || !Number.isInteger(version)) {
    return { success: false, error: "不正なリクエストです" };
  }

  try {
    const command = activateProductCommandFactory();
    await command.execute({ id, expectedVersion: version });

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

  // 楽観ロックトークン（ADR-0039）: 画面表示時の version
  const versionRaw = formData.get("version");
  const version = Number(versionRaw);
  if (typeof versionRaw !== "string" || !Number.isInteger(version)) {
    return { success: false, error: "不正なリクエストです" };
  }

  try {
    const command = deactivateProductCommandFactory();
    await command.execute({ id, expectedVersion: version });

    revalidatePath("/products");
    revalidatePath(`/products/${productCd}`);
  } catch (error) {
    return handleCommandError(error);
  }

  redirect(`/products/${productCd}?reason=${REDIRECT_REASON.PRODUCT_DEACTIVATED}`);
}

// ========================================
// 商品無効化（入れ替え付き）
// ========================================
export async function deactivateWithReplacement(
  productCd: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await verifyAdmin();

  const id = formData.get("id") as string;
  const replacementCode = formData.get("replacementCode") as string;

  // 楽観ロックトークン（ADR-0039）: 画面表示時の version
  const versionRaw = formData.get("version");
  const version = Number(versionRaw);
  if (typeof versionRaw !== "string" || !Number.isInteger(version)) {
    return { success: false, error: "不正なリクエストです" };
  }

  try {
    const command = deactivateProductWithReplacementCommandFactory();
    await command.execute({ id, expectedVersion: version, replacementCode });

    revalidatePath("/products");
    revalidatePath(`/products/${productCd}`);
  } catch (error) {
    return handleCommandError(error);
  }

  redirect(`/products/${productCd}?reason=${REDIRECT_REASON.PRODUCT_DEACTIVATED}`);
}
