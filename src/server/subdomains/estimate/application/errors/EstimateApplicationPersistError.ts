import { ApplicationError } from "@server/shared/errors/ApplicationError";

/**
 * 申請の保存失敗を表すアプリ層例外（#417・ADR-0068 ケース2）
 *
 * version 関門（`Estimate.version` の bump）には成功したが、その後の申請／免除の insert に
 * 失敗した「bump 成功・insert 失敗」の局面で送出する。前進バリエーションは生まれておらず
 * （無害な version 空振り）、利用者は再 Preview → Submit でやり直せる。Server Action 側は
 * `error-handler.ts` の推奨ラップパターンでこの専用文言へ写像する。
 *
 * 元の永続化エラーは `cause` に保持し、ログ・調査に供する。
 */
export class EstimateApplicationPersistError extends ApplicationError {
  constructor(cause: unknown) {
    super("申請に失敗しました。もう一度申請してください。");
    this.cause = cause;
  }
}
