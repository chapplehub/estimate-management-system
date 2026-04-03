"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { createRoleCommandFactory } from "@subdomains/role/application/factories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { createRoleSchema } from "./schema";

// ========================================
// 役割作成
// ========================================
export async function createRole(prevState: unknown, formData: FormData) {
  // 認証・認可チェック: 管理者のみ
  await verifyAdmin();

  // Conformを使用してFormDataをパース・バリデーション
  const submission = parseWithZod(formData, {
    schema: createRoleSchema,
  });

  // バリデーション失敗時はエラーを返却
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { roleCd, name, positionId, superiorRoleId } = submission.value;

  try {
    const command = createRoleCommandFactory();

    await command.execute({
      roleCd,
      name,
      positionId,
      superiorRoleId: superiorRoleId ?? null,
    });

    revalidatePath("/roles");
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  redirect(`/roles?reason=${REDIRECT_REASON.ROLE_CREATED}`);
}
