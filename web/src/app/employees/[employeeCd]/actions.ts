"use server";

import { MailAddressDuplicationCheckDomainService } from "@/shared/domain/services/MailAddressDuplicationCheckDomainService";
import type { ActionResult } from "@/shared/types/ActionResult";
import { DeleteEmployeeCommand } from "@/subdomains/employee/commands/DeleteEmployeeCommand";
import { UpdateEmployeeCommand } from "@/subdomains/employee/commands/UpdateEmployeeCommand";
import { PrismaEmployeeRepository } from "@/subdomains/employee/infra/prisma/PrismaEmployeeRepository";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../_lib/error-handler";
import { updateEmployeeSchema } from "./schema";
import { z } from "zod";

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

  // Zodバリデーション
  const validationResult = updateEmployeeSchema.safeParse(rawData);
  if (!validationResult.success) {
    const { fieldErrors } = z.flattenError(validationResult.error);
    return {
      success: false,
      errors: fieldErrors,
      data: rawData, // エラー時に入力値を返す（フォームの値保持用）
    };
  }

  const { id, name, email, employeeCd, role } = validationResult.data;

  // TODO: Auth.js導入後に権限チェックを追加
  // const session = await auth();
  // if (!session) redirect('/login');
  // if (session.user.id !== id && session.user.role !== 'ADMIN') {
  //   return { success: false, error: '権限がありません' };
  // }

  try {
    const repository = new PrismaEmployeeRepository();
    const mailAddressDuplicationCheck =
      new MailAddressDuplicationCheckDomainService(repository);
    const command = new UpdateEmployeeCommand(
      repository,
      mailAddressDuplicationCheck
    );

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
  const id = formData.get("id") as string;

  // TODO: Auth.js導入後に権限チェックを追加
  // const session = await auth();
  // if (!session) redirect('/login');
  // if (session.user.id !== id && session.user.role !== 'ADMIN') {
  //   return { success: false, error: '権限がありません' };
  // }

  try {
    const repository = new PrismaEmployeeRepository();
    const command = new DeleteEmployeeCommand(repository);

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
