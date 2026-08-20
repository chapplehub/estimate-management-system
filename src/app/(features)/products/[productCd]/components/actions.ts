"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { setProductComponentsCommandFactory } from "@subdomains/product/application/factories/setProductComponentsCommandFactory";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../../_shared/error-handler";

type ComponentInput = { code: string; quantity: number };

export type SetComponentsState = {
  success: boolean;
  error?: string;
} | null;

/**
 * セット構成設定Server Action
 * @param productCd - URLパラメータから取得した商品コード（bind()で渡す）
 */
export async function setProductComponents(
  productCd: string,
  _prevState: SetComponentsState,
  formData: FormData
): Promise<SetComponentsState> {
  await verifyAdmin();

  const componentsJson = formData.get("components");
  if (typeof componentsJson !== "string") {
    return { success: false, error: "不正なリクエストです" };
  }

  // 楽観ロックトークン（ADR-0039）: 画面表示時の version。
  // サーバー側で再取得した値では編集ウィンドウを守れないため、必ずフォーム由来の値を使う
  const versionRaw = formData.get("version");
  const version = Number(versionRaw);
  if (typeof versionRaw !== "string" || !Number.isInteger(version)) {
    return { success: false, error: "不正なリクエストです" };
  }

  let components: ComponentInput[];
  try {
    components = JSON.parse(componentsJson);
  } catch {
    return { success: false, error: "不正なリクエストです" };
  }

  const queryService = new PrismaProductQueryService();
  const product = await queryService.findByCode(productCd);
  if (!product) {
    return { success: false, error: "商品が見つかりません" };
  }

  const resolvedComponents: { componentProductId: string; quantity: number }[] = [];
  for (const comp of components) {
    const componentProduct = await queryService.findByCode(comp.code);
    if (!componentProduct) {
      return { success: false, error: `商品コード「${comp.code}」が見つかりません` };
    }
    resolvedComponents.push({
      componentProductId: componentProduct.id,
      quantity: comp.quantity,
    });
  }

  try {
    const command = setProductComponentsCommandFactory();
    await command.execute({
      productId: product.id,
      expectedVersion: version,
      components: resolvedComponents,
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
