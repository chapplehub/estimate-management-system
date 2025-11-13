"use server";

import { UpdateEmployeeCommand } from "@/subdomains/employee/commands/UpdateEmployeeCommand";
import { PrismaEmployeeRepository } from "@/subdomains/employee/infra/prisma/PrismaEmployeeRepository";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ValidationError,
  BusinessRuleViolationError,
} from "@/shared/errors/DomainError";
import {
  NotFoundError,
  NotFoundEntityError,
} from "@/shared/errors/ApplicationError";

// Server Actionの戻り値の型
type UpdateEmployeeResult =
  | { success: true }
  | { success: false; error: string };

// Server Action: 従業員変更
export async function updateEmployee(
  id: string,
  formData: FormData
): Promise<UpdateEmployeeResult> {
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const employeeCd = formData.get("employeeCd") as string;
  // const password = formData.get("password") as string;
  const role = formData.get("role") as "ADMIN" | "USER";

  try {
    const repository = new PrismaEmployeeRepository();

    const command = new UpdateEmployeeCommand(repository);

    // パスワードをハッシュ化
    // const passwordHash = await hash(password, 10);

    await command.execute({
      id,
      name,
      email,
      employeeCd,
      role,
    });

    revalidatePath("/employee");
    revalidatePath(`/employee/${employeeCd}`);
  } catch (error) {
    console.error("Failed to update employee:", error);

    // Domain層からのエラー: 入力値の検証エラー
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: `入力内容に誤りがあります: ${error.message}`,
      };
    }

    // Domain層からのエラー: ビジネスルール違反
    if (error instanceof BusinessRuleViolationError) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Application層からのエラー: リソースが見つからない
    if (error instanceof NotFoundEntityError || error instanceof NotFoundError) {
      return {
        success: false,
        error: "指定された従業員が見つかりません",
      };
    }

    // それ以外の予期しないエラー（インフラ層のエラー、ネットワークエラーなど）
    return {
      success: false,
      error:
        "従業員の更新に失敗しました。しばらくしてから再度お試しください。",
    };
  }

  // 成功時は詳細ページにリダイレクト
  redirect(`/employee/${employeeCd}`);
}
