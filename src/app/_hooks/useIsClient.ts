import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * クライアント環境かどうかを判定するフック。
 *
 * useSyncExternalStoreのgetServerSnapshotはサーバーレンダリング時と
 * クライアントのハイドレーション時に使用されるため、サーバーHTMLと
 * ハイドレーション時のレンダリングが一致し、ミスマッチを防止できる。
 *
 * @see https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering
 */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
