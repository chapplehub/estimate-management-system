"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { approveStepCommandFactory } from "@subdomains/estimate/application/factories/approveStepCommandFactory";
import { rejectStepCommandFactory } from "@subdomains/estimate/application/factories/rejectStepCommandFactory";
import { withdrawApplicationCommandFactory } from "@subdomains/estimate/application/factories/withdrawApplicationCommandFactory";
import type { ActionResult } from "@shared/types/ActionResult";
import { handleCommandError } from "../../../_shared/error-handler";

/** 承認結果の判別子。最終承認（全ステップ承認済）か、途中承認（次ステップへ前進）か。 */
export type ApproveOutcome = "APPROVED" | "STILL_PENDING";

/** 操作者の従業員情報が取得できない場合の共通文言（前例: 申請の operator null）。 */
const OPERATOR_UNRESOLVED_MESSAGE =
  "操作者の従業員情報が取得できないため操作できません。管理者にお問い合わせください。";

/**
 * `handleCommandError` を ActionResult<T> の失敗アームへブリッジする（#494 と同型）。
 *
 * `handleCommandError` の戻り型 `ActionResult<void>` は成功アームの `data:void` がジェネリック T と
 * 不一致になり `return handleCommandError(error)` が型不整合になる。失敗アーム（T 非依存）だけを
 * 組み直して任意の ActionResult<T> に代入可能な形へ落とす。
 */
function toActionError(error: unknown): { success: false; error?: string } {
  const result = handleCommandError(error);
  return { success: false, error: result.success ? undefined : result.error };
}

/**
 * 認証セッションから操作者の employeeId を解決する（null は操作不可）。
 *
 * 承認・差戻・取下いずれも client の operator を信頼せずセッションから注入する。BE が最終防衛
 * （役割メンバー検証・本人性検証）を担うため、FE は「誰が操作しているか」をセッションで確定するだけ。
 */
async function resolveOperator(): Promise<
  { success: true; operatorEmployeeId: string } | { success: false; error?: string }
> {
  const session = await verifySession();
  const operatorEmployeeId = session.user.employeeId;
  if (!operatorEmployeeId) {
    return { success: false, error: OPERATOR_UNRESOLVED_MESSAGE };
  }
  return { success: true, operatorEmployeeId };
}

/**
 * ステップ承認（§7.1・#575）の Server Action。
 *
 * operator は認証セッションの employeeId（null は操作不可）、stepId と expectedVersion は画面表示時に
 * DTO（operations）から得た値を client エコーする。expectedVersion はサーバで読み直さない（TOCTOU
 * 防御の関門トークン・ADR-0068）。成功時は返却集約の applicationStatus から outcome を導出して返す
 * （最終承認=APPROVED / 途中承認=STILL_PENDING）。呼び出し元はこの判別子で成功トーストの文言を分ける。
 * redirect はせず、画面更新は呼び出し元の `router.refresh()` に委ねる（#562 申請ボタンモデル）。
 * 競合（ConflictError）・業務例外（BusinessRuleViolationError）は handleCommandError でメッセージ化する。
 */
export async function approveStep(
  stepId: string,
  expectedVersion: number
): Promise<ActionResult<{ outcome: ApproveOutcome }>> {
  const operator = await resolveOperator();
  if (!operator.success) {
    return operator;
  }

  try {
    const application = await approveStepCommandFactory().execute({
      stepId,
      approverEmployeeId: operator.operatorEmployeeId,
      expectedVersion,
    });
    const outcome: ApproveOutcome =
      application.applicationStatus.value === "APPROVED" ? "APPROVED" : "STILL_PENDING";
    return { success: true, data: { outcome } };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * ステップ差戻（§7.2・#575）の Server Action。
 *
 * operator はセッション注入、stepId と expectedVersion は client エコー（ADR-0068）。comment は生文字列で
 * 渡し、必須・1〜2000字・trim の権威は BE の VO `RejectionComment`（FE はミラーしない・ADR-0069）。
 * すり抜けた不正コメントは ValidationError として handleCommandError 経由で表面化する。redirect しない。
 */
export async function rejectStep(
  stepId: string,
  comment: string,
  expectedVersion: number
): Promise<ActionResult> {
  const operator = await resolveOperator();
  if (!operator.success) {
    return operator;
  }

  try {
    await rejectStepCommandFactory().execute({
      stepId,
      rejecterEmployeeId: operator.operatorEmployeeId,
      comment,
      expectedVersion,
    });
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * 申請取下（§7.3・#575）の Server Action。
 *
 * operator はセッション注入、applicationId と expectedVersion は client エコー（ADR-0068）。本人性
 * （申請者本人のみ取下可）の権威は BE のドメイン withdraw（集約内で完結）。redirect しない。
 */
export async function withdrawApplication(
  applicationId: string,
  expectedVersion: number
): Promise<ActionResult> {
  const operator = await resolveOperator();
  if (!operator.success) {
    return operator;
  }

  try {
    await withdrawApplicationCommandFactory().execute({
      applicationId,
      operatorEmployeeId: operator.operatorEmployeeId,
      expectedVersion,
    });
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
