"use server";

import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { createEmployeeCommandFactory } from "@subdomains/employee/application/factories/createEmployeeCommandFactory";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../_lib/error-handler";
import { createEmployeeSchema } from "./schema";

// ========================================
// 従業員作成
// ========================================
export async function createEmployee(prevState: unknown, formData: FormData) {
  // 認証・認可チェック: 管理者のみ
  await verifyAdmin();

  // Conformを使用してFormDataをパース・バリデーション
  const submission = parseWithZod(formData, {
    schema: createEmployeeSchema,
  });

  // バリデーション失敗時はエラーを返却(useActionStateの戻り値としてlastResultにエラーが設定される)
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { name, email, employeeCd, role, password, departmentId } = submission.value;

  try {
    // DIはファクトリで解決（インフラ層への依存をserver/側に閉じ込める）
    const command = createEmployeeCommandFactory();

    // Employee と認証ユーザー（User/Account）を同時に作成
    await command.execute({
      name,
      email,
      employeeCd,
      departmentId,
      role,
      password,
    });

    revalidatePath("/employees");
  } catch (error) {
    // ドメイン層エラーをConform形式に変換
    const errorResult = handleCommandError(error);
    // ActionResultのdiscriminated unionを考慮
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    // バックエンド側のエラーをフロントエンドに返却
    return submission.reply({
      formErrors: errorMessage ? [errorMessage] : [],
    });
  }

  // 成功時は一覧ページにリダイレクト
  redirect(`/employees?reason=${REDIRECT_REASON.EMPLOYEE_CREATED}`);
}
