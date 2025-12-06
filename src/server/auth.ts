import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60, // seconds
    updateAge: 60 * 30, // seconds
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // seconds
      strategy: "compact",
    },
  },
});
