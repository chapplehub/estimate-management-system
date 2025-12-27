import type { ActionResult } from "@shared/types/ActionResult";

/**
 * @deprecated このユーティリティは廃止されました。useEffectを使用してください。
 *
 * ## 廃止理由
 *
 * 1. **一貫性の欠如**: redirect時（create/delete）はURLパラメータ方式、
 *    同じ画面に留まる時（update）のみwithCallbacksという使い分けが発生し、
 *    コードベースの理解コストが増加する。
 *
 * 2. **Conformとの非互換性**: withCallbacksはActionResult型（success: boolean）を
 *    期待するが、ConformはSubmissionResult型（status: 'success' | 'error'）を返すため、
 *    互換性がない。
 *
 * 3. **学習コストの発生**: 独自パターンであるため、新規参加者に学習コストが発生する。
 *    React標準のuseEffectを使用する方が理解しやすい。
 *
 * ## 代替方法
 *
 * ```typescript
 * // useEffectでlastResultを監視してtoast表示
 * useEffect(() => {
 *   if (lastResult?.status === "success") {
 *     toast.success("更新しました。");
 *   }
 * }, [lastResult]);
 * ```
 *
 * @see GitHub Issue: https://github.com/chapplehub/estimate-management-system/issues/36
 *
 * ---
 *
 * 以下は廃止前の説明（参考用）:
 *
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
