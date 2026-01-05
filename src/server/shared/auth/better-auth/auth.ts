import prisma from "@server/prisma";
import type { UserRole } from "@server/shared/auth/types";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, customSession } from "better-auth/plugins";

/**
 * Better Auth の設定
 * nextCookies プラグインにより Server Action でのサインイン時に
 * 自動的にクッキーが設定される
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60, // 1 hour
    updateAge: 60 * 30, // 30 minutes
    freshAge: 60 * 10, // 10 minutes
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
      strategy: "compact",
    },
  },
  plugins: [
    admin(), // 管理者によるUser作成・削除・更新を可能にする
    customSession(async ({ user, session }) => {
      // User から employeeId と role をセッションに追加
      // NOTE: better-authの実装が直接prismaに依存しているが、以下の２つが理由で許容。依存が増えてきたら要検討
      // better-auth自体がprismaAdapterでprismaに依存していること
      // 依存範囲がここだけなのでインターフェース等の実装は不要と判断
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { employeeId: true, role: true },
      });

      return {
        session,
        user: {
          ...user,
          employeeId: dbUser?.employeeId ?? null,
          // User.roleを使用（"admin" | "user"）
          role: (dbUser?.role as UserRole) ?? null,
        },
      };
    }),
    nextCookies(), // Server Action でクッキーを自動設定（配列の最後に置く）
  ],
});
