import prisma from "@server/prisma";
import { TransactionRunner } from "@server/shared/application/transaction/TransactionRunner";
import { runInTx } from "./txContext";

/**
 * TransactionRunner ポートの Prisma アダプタ（ADR-20260626-dee）。
 *
 * `$transaction` を開き、その tx を AsyncLocalStorage に seed してから work を実行する。
 * work 内のリポジトリは `currentClient()` でこの tx を拾い、同一トランザクションで動く。
 * DIP: 本具象（infra）が app 層の TransactionRunner 抽象を実装する（ソース依存 infra→app）。
 */
export class PrismaTransactionRunner implements TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T> {
    return prisma.$transaction((tx) => runInTx(tx, work));
  }
}
