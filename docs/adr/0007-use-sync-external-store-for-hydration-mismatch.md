# ADR-0007: useSyncExternalStoreによるハイドレーションミスマッチの防止

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-03-26 |
| 最終更新日 | 2026-03-26 |

## コンテキスト

`UserDisplay`コンポーネントは`useSession()`フックでクライアントサイドのセッション情報を取得し、ユーザー名を表示するClient Componentである。

`useSession()`はサーバーとクライアントで異なる初期値を返す:

- **サーバーレンダリング時**: `isPending: true` → `<Loader2Icon>`（SVGスピナー）を描画
- **クライアントハイドレーション時**: `isPending: false`（セッションがCookieから即座に取得可能）→ `<span>`（ユーザー名）を描画

このDOM構造の不一致によりReactがハイドレーションミスマッチを検出し、最も近いSuspense境界（存在しない場合はルート）までのDOMツリーを再構築する。この再構築中に`<Link>`等のインタラクティブ要素が破棄→再作成されるため、ユーザーのクリックが消失する問題が発生していた。

## 検討した選択肢

### A. `useEffect` + `useState`パターン（不採用）

```tsx
const [isClient, setIsClient] = useState(false);
useEffect(() => { setIsClient(true); }, []);
```

- Next.js公式ドキュメントのSolution 1として推奨
- プロジェクトのESLintルール`react-hooks/set-state-in-effect`に抵触し、コミット不可
- `eslint-disable`で回避可能だが、React公式の方向性（effect内でsetStateしない）に逆行する

### B. `next/dynamic`による`ssr: false`（不採用）

```tsx
const UserDisplay = dynamic(() => import("./user-display"), { ssr: false });
```

- Next.js公式ドキュメントのSolution 2
- ESLintルールに抵触しない
- 修正箇所が利用側（header.tsx）になり、別の場所からUserDisplayを直接importすると同じ問題が再発する

### C. `useSyncExternalStore`（採用）

```tsx
function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
```

- React公式ドキュメントのAdding support for server renderingに記載されたパターン
- ESLintルールに抵触しない
- 修正がコンポーネント内で完結し、どこからimportしても安全

## 決定

`useSyncExternalStore`を採用し、`useIsClient`カスタムフックとして`src/app/_hooks/useIsClient.ts`に切り出す。

## 根拠

### `useSyncExternalStore`の動作がこのユースケースに適合する

React公式ドキュメントの`useOnlineStatus`の例と構造が同一である:

| 観点 | useOnlineStatus（公式例） | useIsClient（今回） |
|---|---|---|
| 課題 | `navigator.onLine`がサーバーで使えない | `useSession()`がサーバーで正しい値を返さない |
| `getSnapshot` | `navigator.onLine`（実際の値） | `true`（クライアントにいる） |
| `getServerSnapshot` | `true`（安全なデフォルト） | `false`（スピナーを表示） |

`getServerSnapshot`は**サーバーレンダリング時**と**クライアントのハイドレーション時**の両方で使用されるため、サーバーHTMLとハイドレーション時のレンダリングが一致し、ミスマッチが発生しない。

### 不採用理由

- **選択肢A**: ESLintルール違反の回避に`eslint-disable`が必要。ルール自体はReact公式の方向性に沿ったものであり、無効化の正当性が弱い
- **選択肢B**: 問題の原因はコンポーネント側にあるが、修正が利用側に漏れる設計になり、再発リスクがある

## 影響

- `useIsClient`フックは他のClient Componentでも再利用可能
- `useSession()`以外にもサーバー/クライアントで異なる値を返すフックを使う場面で同じパターンを適用できる
