/**
 * 集約またぎトランザクション境界のポート（アプリ層所有・ADR-0069）。
 *
 * 複数集約を1つの原子単位で書き込むユースケース（申請 submit の version bump + 申請挿入など）が、
 * 「何が原子的か」をアプリ層で宣言するための抽象。トランザクションは非ドメイン概念ゆえドメイン層
 * （repository インターフェース群）ではなく shared/application に置く（ADR-0039 の version=非業務概念と
 * 同型論法）。
 *
 * シグネチャは Prisma 型ゼロの thunk `run<T>(work)` に保つ。実トランザクションハンドル
 * （Prisma.TransactionClient）はインフラ層（PrismaTransactionRunner + AsyncLocalStorage ストア +
 * currentClient）にのみ棲み、アプリ層へ漏らさない。DIP により具象（infra）のソース依存が本抽象へ向く。
 */
export interface TransactionRunner {
  /** work 内の全リポジトリ操作を単一トランザクションで原子化する。work が throw すれば全体をロールバックする。 */
  run<T>(work: () => Promise<T>): Promise<T>;
}
