"use server";

import { verifyAdmin } from "@server/shared/auth";
import type { ActionResult } from "@shared/types/ActionResult";
import { createEmployeeCommandFactory } from "@subdomains/employee/application/factories/createEmployeeCommandFactory";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { handleCommandError } from "../_lib/error-handler";
import { createEmployeeSchema } from "./schema";

// ========================================
// 従業員作成
// ========================================
export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // TODO: const isVerified = await verifyAdmin();みたいな感じにして、isVerifiedでその後の処理を実行するか、エラーにするか判断する。
  await verifyAdmin();

  // フォームデータをオブジェクト化
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    employeeCd: formData.get("employeeCd"),
    password: formData.get("password"),
    role: formData.get("role"),
  };

  // Zodバリデーション（プレゼンテーション層の責務）
  const validationResult = createEmployeeSchema.safeParse(rawData);
  if (!validationResult.success) {
    const { fieldErrors } = z.flattenError(validationResult.error);
    return {
      success: false,
      errors: fieldErrors,
      data: rawData,
    };
  }

  const { name, email, employeeCd, role } = validationResult.data;

  try {
    // DIはファクトリで解決（インフラ層への依存をserver/側に閉じ込める）
    const command = createEmployeeCommandFactory();

    // NOTE: パスワードは better-auth (User/Account) で管理
    // 従業員作成後、別途 better-auth の API で認証情報を登録する

    await command.execute({
      name,
      email,
      employeeCd,
      role,
    });

    revalidatePath("/employees");
  } catch (error) {
    return handleCommandError(error);
  }

  // 成功時は一覧ページにリダイレクト
  redirect("/employees");
}
