"use server";

import { getRequiredSession } from "@/app/_lib/getRequiredSession";
import { isAdmin, isOwner } from "@server/shared/auth";
import type { ActionResult } from "@shared/types/ActionResult";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { deleteEmployeeCommandFactory } from "@subdomains/employee/application/factories/deleteEmployeeCommandFactory";
import { updateEmployeeCommandFactory } from "@subdomains/employee/application/factories/updateEmployeeCommandFactory";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { handleCommandError } from "../_lib/error-handler";
import { updateEmployeeSchema } from "./schema";

// ========================================
// 従業員更新
// ========================================
export async function updateEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // フォームデータをオブジェクト化
  const rawData = {
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    employeeCd: formData.get("employeeCd"),
    role: formData.get("role"),
  };

  // Zodバリデーション（プレゼンテーション層の責務）
  const validationResult = updateEmployeeSchema.safeParse(rawData);
  if (!validationResult.success) {
    const { fieldErrors } = z.flattenError(validationResult.error);
    return {
      success: false,
      errors: fieldErrors,
      data: rawData,
    };
  }

  const { id, name, email, employeeCd, role } = validationResult.data;

  // 認証・認可チェック: 本人または管理者
  const session = await getRequiredSession();
  if (!isOwner(session, id) && !isAdmin(session)) {
    redirect(`/signin?reason=${REDIRECT_REASON.FORBIDDEN}`);
  }

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
    return handleCommandError(error);
  }

  // 成功時は詳細ページにリダイレクト
  redirect(`/employees/${employeeCd}`);
}

// ========================================
// 従業員削除
// ========================================
export async function deleteEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // 認証・認可チェック: 管理者のみ
  const session = await getRequiredSession();
  if (!isAdmin(session)) {
    redirect(`/signin?reason=${REDIRECT_REASON.FORBIDDEN}`);
  }

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
  redirect("/employees");
}
