import type { ActionResult } from "@shared/types/ActionResult";

/**
 * withCallbacksパターン - Server Actionにコールバックを追加するユーティリティ
 *
 * useActionStateと組み合わせて使用し、アクションの成功・失敗時に
 * コールバック関数(トースト通知などの副作用)を実行できるようにする。
 *
 * @remarks
 * 同じ画面に留まる場合（redirect不要）のトースト通知などに有用。
 * 別画面にリダイレクトする場合は、従来のURLパラメータ方式を使用。
 *
 * @example
 * ```typescript
 * const [state, action, isPending] = useActionState(
 *   withCallbacks(updateEmployee, {
 *     onSuccess() {
 *       toast.success("更新しました。");
 *     },
 *   }),
 *   { success: true }
 * );
 * ```
 *
 * @see https://zenn.dev/sc30gsw/articles/6b43b44e04e89e
 */

type Callbacks<T> = {
  onSuccess?: (result: ActionResult<T>) => void;
  onError?: (result: ActionResult<T>) => void;
};

export function withCallbacks<T, Args extends unknown[]>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  callbacks: Callbacks<T>
): (...args: Args) => Promise<ActionResult<T>> {
  return async (...args: Args) => {
    const result = await action(...args);

    // server actionの状態変化に応じてcallbacksの処理が変えられる
    if (result.success) {
      callbacks.onSuccess?.(result);
    } else {
      callbacks.onError?.(result);
    }

    return result;
  };
}
