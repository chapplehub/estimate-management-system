import { headers } from "next/headers";
import type { IAuthService } from "../IAuthService";
import type {
  AuthSession,
  AuthUser,
  SignInInput,
  SignInResult,
  SignOutResult,
} from "../types";
import { auth } from "./auth";

/**
 * Better Auth による IAuthService の実装
 */
export class BetterAuthService implements IAuthService {
  async getCurrentSession(): Promise<AuthSession | null> {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return null;
    }

    return {
      session: {
        id: session.session.id,
        userId: session.session.userId,
        expiresAt: session.session.expiresAt,
        createdAt: session.session.createdAt,
        updatedAt: session.session.updatedAt,
      },
      user: this.mapUser(session.user),
    };
  }

  async signIn(input: SignInInput): Promise<SignInResult> {
    try {
      const result = await auth.api.signInEmail({
        body: {
          email: input.email,
          password: input.password,
        },
      });

      if (!result || !result.user) {
        return {
          success: false,
          error: "サインインに失敗しました",
        };
      }

      return {
        success: true,
        user: this.mapUser(result.user),
      };
    } catch (error) {
      // Better Auth のエラーハンドリング
      if (error instanceof Error) {
        // 認証エラーの場合は汎用メッセージを返す（セキュリティ上の理由）
        return {
          success: false,
          error: "メールアドレスまたはパスワードが正しくありません",
        };
      }
      return {
        success: false,
        error: "サインイン中にエラーが発生しました",
      };
    }
  }

  async signOut(): Promise<SignOutResult> {
    try {
      await auth.api.signOut({
        headers: await headers(),
      });
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: "サインアウト中にエラーが発生しました",
      };
    }
  }

  /**
   * Better Auth の User を AuthUser にマッピング
   */
  private mapUser(user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
