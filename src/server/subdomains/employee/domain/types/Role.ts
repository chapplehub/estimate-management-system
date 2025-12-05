/**
 * 従業員の役割
 *
 * ビジネスルール：
 * - ADMIN: 管理者権限を持つユーザー
 * - USER: 一般ユーザー
 */
export const Role = {
  /** 管理者 */
  ADMIN: "ADMIN",
  /** 一般ユーザー */
  USER: "USER",
} as const;

export type Role = (typeof Role)[keyof typeof Role];
