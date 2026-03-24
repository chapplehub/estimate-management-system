/**
 * 認証サービスで使用する型定義
 * Better Auth への依存を避け、アプリケーション独自の型を定義
 */

/**
 * ユーザーロール定数
 *
 * better-auth Admin Plugin が使用する形式に合わせる。
 * - ADMIN: 管理者権限（Employee管理、システム管理等）
 * - USER: 一般ユーザー権限
 */
export const USER_ROLES = {
  ADMIN: "admin",
  USER: "user",
} as const;

/**
 * ユーザーロール型
 */
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

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
  /** ユーザーのロール（認可チェック用） */
  role: UserRole | null;
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
export type SignInResult = { success: true; user: AuthUser } | { success: false; error: string };

/**
 * サインアウト結果
 */
export type SignOutResult = { success: true } | { success: false; error: string };
