import prisma from "@server/prisma";
import { headers } from "next/headers";
import type {
  CreateAuthUserInput,
  CreateAuthUserResult,
  IUserManagementService,
  RemoveAuthUserResult,
  UpdateAuthUserEmailResult,
  UpdateAuthUserRoleResult,
} from "../IUserManagementService";
import type { UserRole } from "../types";
import { auth } from "./auth";

/**
 * Better Auth による IUserManagementService の実装
 *
 * Better Auth Admin API を使用して認証ユーザーの作成・更新・削除を行う。
 * Employee（ドメインエンティティ）と認証ユーザーの同期に使用する。
 */
export class BetterAuthUserManagementService implements IUserManagementService {
  /**
   * 認証ユーザー（User/Account）を作成する
   *
   * 1. Better Auth Admin API で User/Account を作成
   * 2. User.employeeId を更新して Employee と紐づける
   */
  async createUser(input: CreateAuthUserInput): Promise<CreateAuthUserResult> {
    try {
      // Better Auth Admin API でユーザー作成（role も設定）
      const result = await auth.api.createUser({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
          role: input.role,
          data: {
            emailVerified: true,
          },
        },
      });

      if (!result || !result.user) {
        return {
          success: false,
          error: "認証ユーザーの作成に失敗しました",
        };
      }

      // User.employeeId を更新して Employee と紐づける
      await prisma.user.update({
        where: { id: result.user.id },
        data: { employeeId: input.employeeId },
      });

      return {
        success: true,
        userId: result.user.id,
      };
    } catch (error) {
      if (error instanceof Error) {
        // メールアドレス重複エラーのハンドリング
        if (error.message.includes("already exists")) {
          return {
            success: false,
            error: "このメールアドレスは既に登録されています",
          };
        }
        return {
          success: false,
          error: `認証ユーザーの作成に失敗しました: ${error.message}`,
        };
      }
      return {
        success: false,
        error: "認証ユーザーの作成中に予期せぬエラーが発生しました",
      };
    }
  }

  /**
   * 認証ユーザーのメールアドレスを更新する
   *
   * Prisma で直接 User.email を更新する
   * （Better Auth の changeEmail は本人操作を前提としているため）
   */
  async updateUserEmail(
    userId: string,
    newEmail: string
  ): Promise<UpdateAuthUserEmailResult> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { email: newEmail },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        // メールアドレス重複エラーのハンドリング
        if (
          error.message.includes("Unique constraint") ||
          error.message.includes("unique")
        ) {
          return {
            success: false,
            error: "このメールアドレスは既に使用されています",
          };
        }
        return {
          success: false,
          error: `メールアドレスの更新に失敗しました: ${error.message}`,
        };
      }
      return {
        success: false,
        error: "メールアドレスの更新中に予期せぬエラーが発生しました",
      };
    }
  }

  /**
   * 認証ユーザーを削除する
   *
   * Better Auth Admin API で User を削除する
   * Account/Session は onDelete: Cascade で自動削除される
   */
  async removeUser(userId: string): Promise<RemoveAuthUserResult> {
    try {
      await auth.api.removeUser({
        body: { userId },
        headers: await headers(),
      });

      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: `認証ユーザーの削除に失敗しました: ${error.message}`,
        };
      }
      return {
        success: false,
        error: "認証ユーザーの削除中に予期せぬエラーが発生しました",
      };
    }
  }

  /**
   * EmployeeID から紐づく認証ユーザーを検索する
   */
  async findUserByEmployeeId(
    employeeId: string
  ): Promise<{ id: string } | null> {
    return await prisma.user.findUnique({
      where: { employeeId },
      select: { id: true },
    });
  }

  /**
   * 認証ユーザーのロールを更新する
   *
   * Prisma で直接 User.role を更新する
   */
  async updateUserRole(
    userId: string,
    role: UserRole
  ): Promise<UpdateAuthUserRoleResult> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { role },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: `ロールの更新に失敗しました: ${error.message}`,
        };
      }
      return {
        success: false,
        error: "ロールの更新中に予期せぬエラーが発生しました",
      };
    }
  }
}
