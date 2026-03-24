"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { createDepartmentCommandFactory } from "@subdomains/department/application/factories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { createDepartmentSchema } from "./schema";

// ========================================
// 部署作成
// ========================================
export async function createDepartment(prevState: unknown, formData: FormData) {
  // 認証・認可チェック: 管理者のみ
  await verifyAdmin();

  // Conformを使用してFormDataをパース・バリデーション
  const submission = parseWithZod(formData, {
    schema: createDepartmentSchema,
  });

  // バリデーション失敗時はエラーを返却
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { departmentCd, name, abbreviation, parentId } = submission.value;

  try {
    const command = createDepartmentCommandFactory();

    await command.execute({
      departmentCd,
      name,
      abbreviation,
      parentId,
    });

    revalidatePath("/departments");
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  redirect(`/departments?reason=${REDIRECT_REASON.DEPARTMENT_CREATED}`);
}
