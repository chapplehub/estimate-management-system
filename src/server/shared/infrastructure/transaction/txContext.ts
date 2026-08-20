import { AsyncLocalStorage } from "node:async_hooks";
import prisma from "@server/prisma";
import type { Prisma, PrismaClient } from "@generated/prisma/client";

/**
 * 集約またぎトランザクションの ambient 伝播基盤（ADR-20260626-dee）。
 *
 * AsyncLocalStorage に「現在のトランザクションハンドル」を載せ、リポジトリは `currentClient()` で
 * それを取り出す。非同期コンテキストが並行チェーンを構造的に隔離するため、可変ホルダ方式
 * （ClientManager）が持つリクエストスコープ規律依存やシングルトン化の罠が無く並行安全。
 *
 * トランザクションハンドル（Prisma.TransactionClient）は本ファイルと PrismaTransactionRunner に
 * 閉じ込め、アプリ層・ドメイン層へは漏らさない（TransactionRunner ポートは Prisma 型ゼロ）。
 */
type Db = PrismaClient | Prisma.TransactionClient;

const als = new AsyncLocalStorage<Prisma.TransactionClient>();

/** ambient トランザクションがあればそのハンドル、無ければ global prisma を返す。 */
export const currentClient = (): Db => als.getStore() ?? prisma;

/**
 * 自前トランザクションを「join-or-open」で開く。
 *
 * ambient tx があればそれに相乗りして work をそのまま実行（新トランザクションを開かない）。
 * 無ければ自分で `$transaction` を開き、その tx を ambient に載せて work を実行する。
 * これにより各リポジトリの多文メソッドは、単独呼び出しでは従来どおり原子的に振る舞い、
 * TransactionRunner 配下では外側のトランザクションに参加する。
 */
export function runAtomically<T>(work: () => Promise<T>): Promise<T> {
  const ambient = als.getStore();
  if (ambient) {
    return work();
  }
  return prisma.$transaction((tx) => als.run(tx, work));
}
