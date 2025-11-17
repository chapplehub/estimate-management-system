"use server";

import { MailAddressDuplicationCheckDomainService } from "@/shared/domain/services/MailAddressDuplicationCheckDomainService";
import type { ActionResult } from "@/shared/types/ActionResult";
import { CreateEmployeeCommand } from "@/subdomains/employee/commands/CreateEmployeeCommand";
import { PrismaEmployeeRepository } from "@/subdomains/employee/infra/prisma/PrismaEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@/subdomains/employee/services/EmployeeCdDuplicationCheckDomainService";
import { hash } from "bcrypt";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../_lib/error-handler";
import { createEmployeeSchema } from "./schema";
import { z } from "zod";

// ========================================
// 従業員作成
// ========================================
export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // フォームデータをオブジェクト化
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    employeeCd: formData.get("employeeCd"),
    password: formData.get("password"),
    role: formData.get("role"),
  };

  // Zodバリデーション
  const validationResult = createEmployeeSchema.safeParse(rawData);
  if (!validationResult.success) {
    const { fieldErrors } = z.flattenError(validationResult.error);
    return {
      success: false,
      errors: fieldErrors,
    };
  }

  const { name, email, employeeCd, password, role } = validationResult.data;

  // TODO: Auth.js導入後に権限チェックを追加
  // const session = await auth();
  // if (!session) redirect('/login');
  // if (session.user.role !== 'ADMIN') {
  //   return { success: false, error: '権限がありません' };
  // }

  try {
    // TODO: ここでDIしたくない。一括でDIできる共通処理、事前処理を実装したい。
    const repository = new PrismaEmployeeRepository();
    const employeeCdDuplicationCheck =
      new EmployeeCdDuplicationCheckDomainService(repository);
    const mailAddressDuplicationCheck =
      new MailAddressDuplicationCheckDomainService(repository);

    const command = new CreateEmployeeCommand(
      repository,
      employeeCdDuplicationCheck,
      mailAddressDuplicationCheck
    );

    // パスワードをハッシュ化
    const passwordHash = await hash(password, 10);

    await command.execute({
      name,
      email,
      employeeCd,
      passwordHash,
      role,
    });

    revalidatePath("/employees");
  } catch (error) {
    return handleCommandError(error);
  }

  // 成功時は一覧ページにリダイレクト
  redirect("/employees");
}
