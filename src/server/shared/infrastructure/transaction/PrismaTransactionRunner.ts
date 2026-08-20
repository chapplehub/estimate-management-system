import { TransactionRunner } from "@server/shared/application/transaction/TransactionRunner";
import { runAtomically } from "./txContext";

/**
 * TransactionRunner ポートの Prisma アダプタ（ADR-20260626-dee）。
 *
 * `runAtomically` へ委譲する（join-or-open）。ambient tx が無ければ `$transaction` を開いて
 * その tx を AsyncLocalStorage に seed し、あれば外側 tx に相乗りする。work 内のリポジトリは
 * `currentClient()` でこの tx を拾い、同一トランザクションで動く。「$transaction を開いて ALS へ
 * seed する」ロジックを runAtomically と二重実装せず一点に集約し、外側 tx 配下で呼ばれた際に
 * 暗黙ネストせず join する安全性も得る。
 * DIP: 本具象（infra）が app 層の TransactionRunner 抽象を実装する（ソース依存 infra→app）。
 */
export class PrismaTransactionRunner implements TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T> {
    return runAtomically(work);
  }
}
