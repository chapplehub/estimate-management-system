import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import prisma from "@server/prisma";

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
    nextCookies(), // Server Action でクッキーを自動設定（配列の最後に置く）
  ],
});
