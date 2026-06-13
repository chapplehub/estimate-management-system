"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import type { ActionResult } from "@shared/types/ActionResult";
import {
  deleteRoleCommandFactory,
  updateRoleCommandFactory,
} from "@subdomains/role/application/factories";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { updateRoleSchema } from "./schema";

// ========================================
// 役割更新
// ========================================

/**
 * 役割更新Server Action
 * @param roleCd - URLパラメータから取得した役割コード（bind()で渡す）
 * @param prevState - 前回の状態（Conform用）
 * @param formData - フォームデータ
 */
export async function updateRole(roleCd: string, prevState: unknown, formData: FormData) {
  // 認証・認可チェック: 管理者のみ
  await verifyAdmin();

  // Conformを使用してFormDataをパース・バリデーション
  const submission = parseWithZod(formData, {
    schema: updateRoleSchema,
  });

  // バリデーション失敗時はエラーを返却
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { name, superiorRoleId, version } = submission.value;

  // roleCdからidを取得
  const queryService = new PrismaRoleQueryService();
  const role = await queryService.findByRoleCd(roleCd);
  if (!role) {
    return submission.reply({
      formErrors: ["役割が見つかりません"],
    });
  }

  const { id } = role;

  try {
    const command = updateRoleCommandFactory();

    await command.execute({
      id,
      // version はフォーム由来（画面表示時のトークン）を渡す。ここで再 SELECT した
      // 最新 version を使うと編集ウィンドウを守れないため（ADR-0039 選択肢2A）。
      version,
      name,
      superiorRoleId: superiorRoleId ?? null,
    });

    revalidatePath("/roles");
    revalidatePath(`/roles/${roleCd}`);
  } catch (error) {
    // ドメイン層エラーをConform形式に変換
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  // 成功時は同じページにリダイレクト（フォーム状態をリセット）
  redirect(`/roles/${roleCd}?reason=${REDIRECT_REASON.ROLE_UPDATED}`);
}

// ========================================
// 役割削除
// ========================================
export async function deleteRole(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // 認証・認可チェック: 管理者のみ
  await verifyAdmin();

  const id = formData.get("id") as string;
  // version は activate/deactivate と同じくフォーム由来の値を直接読む（Zod 新設せず / ADR-0039）
  const expectedVersion = Number(formData.get("version"));

  try {
    const command = deleteRoleCommandFactory();

    await command.execute({
      id,
      expectedVersion,
    });

    revalidatePath("/roles");
  } catch (error) {
    return handleCommandError(error);
  }

  // 成功時は一覧ページにリダイレクト
  redirect(`/roles?reason=${REDIRECT_REASON.ROLE_DELETED}`);
}
