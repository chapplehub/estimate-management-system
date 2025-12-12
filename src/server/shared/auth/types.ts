import type { Role } from "@generated/prisma/client";

/**
 * 認証サービスで使用する型定義
 * Better Auth への依存を避け、アプリケーション独自の型を定義
 */

/**
 * 認証済みユーザー情報
 */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** 紐づく従業員ID（認可チェック用） */
  employeeId: string | null;
  /** 従業員のロール（認可チェック用） */
  role: Role | null;
};

/**
 * セッション情報
 * NOTE: クライアントでsessionを使用していないので必要か怪しいがbetter-authがgetSessionで返してくれているものをとりあえずそのまま定義している。不要なら消す。
 */
export type AuthSession = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  user: AuthUser;
};

/**
 * サインイン入力
 */
export type SignInInput = {
  email: string;
  password: string;
};

/**
 * サインイン結果
 */
export type SignInResult =
  | { success: true; user: AuthUser }
  | { success: false; error: string };

/**
 * サインアウト結果
 */
export type SignOutResult =
  | { success: true }
  | { success: false; error: string };
