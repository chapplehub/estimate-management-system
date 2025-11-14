"use server";

import {
  NotFoundEntityError,
  NotFoundError,
} from "@/shared/errors/ApplicationError";
import {
  BusinessRuleViolationError,
  ValidationError,
} from "@/shared/errors/DomainError";
import { CreateEmployeeCommand } from "@/subdomains/employee/commands/CreateEmployeeCommand";
import { DeleteEmployeeCommand } from "@/subdomains/employee/commands/DeleteEmployeeCommand";
import { UpdateEmployeeCommand } from "@/subdomains/employee/commands/UpdateEmployeeCommand";
import { PrismaEmployeeRepository } from "@/subdomains/employee/infra/prisma/PrismaEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@/subdomains/employee/services/EmployeeCdDuplicationCheckDomainService";
import { hash } from "bcrypt";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Server Actionの戻り値の型
type ActionResult = { success: true } | { success: false; error: string };

// ========================================
// 従業員作成
// ========================================
export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const employeeCd = formData.get("employeeCd") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as "ADMIN" | "USER";

  // TODO: Auth.js導入後に権限チェックを追加
  // const session = await auth();
  // if (!session) redirect('/login');
  // if (session.user.role !== 'ADMIN') {
  //   return { success: false, error: '権限がありません' };
  // }

  try {
    // TODO: ここにバックエンドのロジックが入り込んではいけないはず
    const repository = new PrismaEmployeeRepository();
    const employeeCdDuplicationCheck =
      new EmployeeCdDuplicationCheckDomainService(repository);

    const command = new CreateEmployeeCommand(
      repository,
      employeeCdDuplicationCheck
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
    console.error("Failed to create employee:", error);

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
    if (
      error instanceof NotFoundEntityError ||
      error instanceof NotFoundError
    ) {
      return {
        success: false,
        error: "指定された従業員が見つかりません",
      };
    }

    // それ以外の予期しないエラー（インフラ層のエラー、ネットワークエラーなど）
    return {
      success: false,
      error: "従業員の作成に失敗しました。しばらくしてから再度お試しください。",
    };
  }

  // 成功時は一覧ページにリダイレクト
  redirect("/employees");
}

// ========================================
// 従業員更新
// ========================================
export async function updateEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = formData.get("id") as string;
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const employeeCd = formData.get("employeeCd") as string;
  const role = formData.get("role") as "ADMIN" | "USER";

  // TODO: Auth.js導入後に権限チェックを追加
  // const session = await auth();
  // if (!session) redirect('/login');
  // if (session.user.id !== id && session.user.role !== 'ADMIN') {
  //   return { success: false, error: '権限がありません' };
  // }

  try {
    const repository = new PrismaEmployeeRepository();
    const command = new UpdateEmployeeCommand(repository);

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
    if (
      error instanceof NotFoundEntityError ||
      error instanceof NotFoundError
    ) {
      return {
        success: false,
        error: "指定された従業員が見つかりません",
      };
    }

    // それ以外の予期しないエラー（インフラ層のエラー、ネットワークエラーなど）
    return {
      success: false,
      error: "従業員の更新に失敗しました。しばらくしてから再度お試しください。",
    };
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
    if (
      error instanceof NotFoundEntityError ||
      error instanceof NotFoundError
    ) {
      return {
        success: false,
        error: "指定された従業員が見つかりません",
      };
    }

    // それ以外の予期しないエラー（インフラ層のエラー、ネットワークエラーなど）
    return {
      success: false,
      error: "従業員の削除に失敗しました。しばらくしてから再度お試しください。",
    };
  }

  // 成功時は一覧ページにリダイレクト
  redirect("/employees");
}
