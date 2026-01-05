"use server";

import {
  verifyAdmin,
  verifyOwnerOrAdmin,
} from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import type { ActionResult } from "@shared/types/ActionResult";
import { deleteEmployeeCommandFactory } from "@subdomains/employee/application/factories/deleteEmployeeCommandFactory";
import { updateEmployeeCommandFactory } from "@subdomains/employee/application/factories/updateEmployeeCommandFactory";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../_lib/error-handler";
import { updateEmployeeSchema } from "./schema";

// ========================================
// 従業員更新
// ========================================

/**
 * 従業員更新Server Action
 * @param employeeCd - URLパラメータから取得した従業員コード（bind()で渡す）
 * @param prevState - 前回の状態（Conform用）
 * @param formData - フォームデータ
 */
export async function updateEmployee(
  employeeCd: string,
  prevState: unknown,
  formData: FormData
) {
  // Conformを使用してFormDataをパース・バリデーション
  const submission = parseWithZod(formData, {
    schema: updateEmployeeSchema,
  });

  // バリデーション失敗時はエラーを返却
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { name, email, role } = submission.value;

  // employeeCdからidを取得
  const queryService = new PrismaEmployeeQueryService();
  const employee = await queryService.findByEmployeeCd(employeeCd);
  if (!employee) {
    return submission.reply({
      formErrors: ["従業員が見つかりません"],
    });
  }

  const { id } = employee;

  // 認証・認可チェック: 本人または管理者
  await verifyOwnerOrAdmin(id);

  try {
    // DIはファクトリで解決（インフラ層への依存をserver/側に閉じ込める）
    const command = updateEmployeeCommandFactory();

    await command.execute({
      id,
      name,
      email,
      employeeCd,
      role,
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeCd}`);
  } catch (error) {
    // ドメイン層エラーをConform形式に変換
    const errorResult = handleCommandError(error);
    const errorMessage =
      !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  // 成功時は同じページにリダイレクト（フォーム状態をリセット）
  redirect(`/employees/${employeeCd}?reason=${REDIRECT_REASON.EMPLOYEE_UPDATED}`);
}

// ========================================
// 従業員削除
// ========================================
export async function deleteEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // 認証・認可チェック: 管理者のみ
  await verifyAdmin();

  const id = formData.get("id") as string;

  try {
    // DIはファクトリで解決（インフラ層への依存をserver/側に閉じ込める）
    const command = deleteEmployeeCommandFactory();

    await command.execute({
      id,
    });

    revalidatePath("/employees");
  } catch (error) {
    return handleCommandError(error);
  }

  // 成功時は一覧ページにリダイレクト
  redirect(`/employees?reason=${REDIRECT_REASON.EMPLOYEE_DELETED}`);
}
