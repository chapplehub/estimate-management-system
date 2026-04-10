"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { setProductRelationsCommandFactory } from "@subdomains/product/application/factories/setProductRelationsCommandFactory";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../../_shared/error-handler";

type RelationInput = { code: string; quantity: number };

export type SetRelationsState = {
  success: boolean;
  error?: string;
} | null;

/**
 * 周辺商品設定Server Action
 * @param productCd - URLパラメータから取得した商品コード（bind()で渡す）
 */
export async function setProductRelations(
  productCd: string,
  _prevState: SetRelationsState,
  formData: FormData
): Promise<SetRelationsState> {
  await verifyAdmin();

  const relationsJson = formData.get("relations");
  if (typeof relationsJson !== "string") {
    return { success: false, error: "不正なリクエストです" };
  }

  let relations: RelationInput[];
  try {
    relations = JSON.parse(relationsJson);
  } catch {
    return { success: false, error: "不正なリクエストです" };
  }

  const queryService = new PrismaProductQueryService();
  const product = await queryService.findByCode(productCd);
  if (!product) {
    return { success: false, error: "商品が見つかりません" };
  }

  const resolvedRelations: { relatedProductId: string; quantity: number }[] = [];
  for (const rel of relations) {
    const relatedProduct = await queryService.findByCode(rel.code);
    if (!relatedProduct) {
      return { success: false, error: `商品コード「${rel.code}」が見つかりません` };
    }
    resolvedRelations.push({
      relatedProductId: relatedProduct.id,
      quantity: rel.quantity,
    });
  }

  try {
    const command = setProductRelationsCommandFactory();
    await command.execute({
      productId: product.id,
      relations: resolvedRelations,
    });

    revalidatePath(`/products/${productCd}`);
  } catch (error) {
    const errorResult = handleCommandError(error);
    return {
      success: false,
      error: !errorResult.success && errorResult.error ? errorResult.error : undefined,
    };
  }

  redirect(`/products/${productCd}?reason=${REDIRECT_REASON.PRODUCT_UPDATED}`);
}
