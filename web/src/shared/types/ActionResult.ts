/**
 * Server Actionの戻り値の型
 *
 * @template T - 成功時に返すデータの型（省略可能）
 *
 * @remarks
 * この型はZodバリデーションと統合することを想定している。
 * - error: 単一のエラーメッセージ（一般的なエラー用）
 * - errors: フィールドごとのエラー配列（Zodバリデーション用）
 *
 * formDataフィールドは含まない（React公式推奨に従い、クライアント側でformRefを使用して管理）
 */
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | {
      success: false;
      error?: string; // 単一エラーメッセージ
      errors?: Record<string, string[]>; // フィールドごとのエラー配列（Zod用）
    };
