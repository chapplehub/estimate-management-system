"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import type { ActionResult } from "@shared/types/ActionResult";
import { deleteDepartmentCommandFactory } from "@subdomains/department/application/factories/deleteDepartmentCommandFactory";
import { updateDepartmentCommandFactory } from "@subdomains/department/application/factories/updateDepartmentCommandFactory";
import { PrismaDepartmentQueryService } from "@subdomains/department/infrastructure/queries/PrismaDepartmentQueryService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { updateDepartmentSchema } from "./schema";

// ========================================
// 部署更新
// ========================================

/**
 * 部署更新Server Action
 * @param departmentCd - URLパラメータから取得した部署コード（bind()で渡す）
 * @param prevState - 前回の状態（Conform用）
 * @param formData - フォームデータ
 */
export async function updateDepartment(
  departmentCd: string,
  prevState: unknown,
  formData: FormData
) {
  // 認証・認可チェック: 管理者のみ
  await verifyAdmin();

  // Conformを使用してFormDataをパース・バリデーション
  const submission = parseWithZod(formData, {
    schema: updateDepartmentSchema,
  });

  // バリデーション失敗時はエラーを返却
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { name, abbreviation, parentId, isActive, version } = submission.value;

  // departmentCdからidを取得
  const queryService = new PrismaDepartmentQueryService();
  const department = await queryService.findByDepartmentCd(departmentCd);
  if (!department) {
    return submission.reply({
      formErrors: ["部署が見つかりません"],
    });
  }

  const { id } = department;

  try {
    const command = updateDepartmentCommandFactory();

    await command.execute({
      id,
      version,
      name,
      abbreviation,
      parentId: parentId ?? null,
      isActive,
    });

    revalidatePath("/departments");
    revalidatePath(`/departments/${departmentCd}`);
  } catch (error) {
    // ドメイン層エラーをConform形式に変換
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  // 成功時は同じページにリダイレクト（フォーム状態をリセット）
  redirect(`/departments/${departmentCd}?reason=${REDIRECT_REASON.DEPARTMENT_UPDATED}`);
}

// ========================================
// 部署削除
// ========================================
export async function deleteDepartment(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // 認証・認可チェック: 管理者のみ
  await verifyAdmin();

  const id = formData.get("id") as string;
  // version は activate/deactivate と同じくフォーム由来の値を直接読む（Zod 新設せず / ADR-0039）
  const expectedVersion = Number(formData.get("version"));

  try {
    const command = deleteDepartmentCommandFactory();

    await command.execute({
      id,
      expectedVersion,
    });

    revalidatePath("/departments");
  } catch (error) {
    return handleCommandError(error);
  }

  // 成功時は一覧ページにリダイレクト
  redirect(`/departments?reason=${REDIRECT_REASON.DEPARTMENT_DELETED}`);
}
