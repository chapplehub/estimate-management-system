/**
 * Server Actionの戻り値の型
 *
 * @template T - 成功時に返すデータの型（省略可能）
 *
 * @remarks
 * この型はZodバリデーションと統合することを想定している。
 * - error: 単一のエラーメッセージ（一般的なエラー用）
 * - errors: フィールドごとのエラー配列（Zodバリデーション用）
 * - data: フォーム入力値の保持用（バリデーションエラー時に入力値を返す）
 *
 * @example
 * // バリデーションエラー時
 * return {
 *   success: false,
 *   errors: { name: ["名前は必須です"] },
 *   data: { name: "入力された名前", email: "入力されたメール" }
 * };
 *
 * // 成功時
 * return { success: true };
 */
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | {
      success: false;
      error?: string; // 単一エラーメッセージ
      errors?: Record<string, string[]>; // フィールドごとのエラー配列（Zod用）
      data?: Record<string, unknown>; // フォーム入力値の保持用
    };
