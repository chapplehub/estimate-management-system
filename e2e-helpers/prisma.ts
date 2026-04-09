/**
 * E2Eテスト用 Prisma クライアント
 *
 * テスト内でDBを直接操作するためのクライアント。
 * .env.test の DATABASE_URL に接続する。
 *
 * 使い方:
 *   import { prisma } from "../../e2e-helpers/prisma";
 *
 *   test.afterEach(async () => {
 *     await prisma.employee.deleteMany({ where: { employeeCd: "EMP099901" } });
 *   });
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "../generated/prisma/client";

config({ path: ".env.test" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });
