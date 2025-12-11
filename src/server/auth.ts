import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import prisma from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // The duration of each is in seconds
  session: {
    expiresIn: 60 * 60,
    updateAge: 60 * 30,
    freshAge: 60 * 10,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
      strategy: "compact",
    },
  },
});

/**
 * Server Component / Server Action でセッションを取得する
 */
export async function getUserSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
