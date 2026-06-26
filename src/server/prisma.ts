import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    // 対話トランザクションの予算を明示する（無指定だと Prisma 既定の暗黙値に依存する）。
    // atomic submit（ADR-20260626-dee）で version 関門＋申請挿入を1 tx に束ねるため、予算の
    // 出どころを可視化しておく。現状は Prisma 既定値を踏襲（timeout 5s / maxWait 2s）。延長要否は
    // bumpVersion による tx 短縮後の実測で別途判断する。タイムアウト（P2028）のエラー翻訳は本対応の
    // スコープ外（タイムアウトは競合ではなく、再読込で解決しないため ConflictError へはマップしない）。
    transactionOptions: {
      timeout: 5000,
      maxWait: 2000,
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
