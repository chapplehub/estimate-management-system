"use server";

import { DeleteEmployeeCommand } from "@/subdomains/employee/commands/DeleteEmployeeCommand";
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
type DeleteEmployeeResult =
  | { success: true }
  | { success: false; error: string };

// Server Action: 従業員削除
export async function deleteEmployee(
  _prevState: DeleteEmployeeResult,
  formData: FormData
): Promise<DeleteEmployeeResult> {
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

    revalidatePath("/employee");
  } catch (error) {
    console.error("Failed to delete employee:", error);

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
        "従業員の削除に失敗しました。しばらくしてから再度お試しください。",
    };
  }

  // 成功時は一覧ページにリダイレクト
  redirect("/employee");
}
