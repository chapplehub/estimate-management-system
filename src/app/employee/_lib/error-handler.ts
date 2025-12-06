import {
  NotFoundEntityError,
  NotFoundError,
} from "@server/shared/errors/ApplicationError";
import {
  BusinessRuleViolationError,
  ValidationError,
} from "@server/shared/errors/DomainError";
import type { ActionResult } from "@shared/types/ActionResult";

/**
 * Server Action内で発生したエラーを適切なActionResultに変換する
 *
 * @param error - キャッチされたエラー
 * @returns ActionResult型のエラーレスポンス
 *
 * @remarks
 * このハンドラは以下のエラーを処理する：
 * - ValidationError: ドメイン層の入力値検証エラー
 * - BusinessRuleViolationError: ビジネスルール違反
 * - NotFoundEntityError/NotFoundError: リソース未発見
 * - その他の予期しないエラー
 */
export function handleCommandError(error: unknown): ActionResult {
  console.error("Command failed:", error);

  if (error instanceof ValidationError) {
    return {
      success: false,
      error: `入力内容に誤りがあります: ${error.message}`,
    };
  }

  if (error instanceof BusinessRuleViolationError) {
    return { success: false, error: error.message };
  }

  if (error instanceof NotFoundEntityError || error instanceof NotFoundError) {
    return { success: false, error: "指定されたリソースが見つかりません" };
  }

  return {
    success: false,
    error: "処理に失敗しました。しばらくしてから再度お試しください。",
  };
}
