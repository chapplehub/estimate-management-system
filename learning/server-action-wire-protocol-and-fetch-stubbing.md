# Server Action の実体は next-action ヘッダ付き POST fetch — fetch 差し替えで失敗を実機再現する

作成日: 2026-07-24

## 概要

Next.js App Router の Server Action は、クライアントから見ると「関数呼び出し」に見えるが、実体は **`next-action` ヘッダ付きの POST fetch** である。この事実を使うと、`window.fetch` をブラウザ側で差し替えるだけで、**コードも DB も触らずに Server Action だけを意図的に失敗させられる**。

PR #634（#633: `callReadAction` によるエラーハンドリング統一）で、失敗時の UI 挙動（toast 表示・モーダルが閉じないこと・state 凍結・リトライ可能性）を実機検証するために使った手法。ユニットテストでは担保しきれない「実ブラウザでの見え方」を確認できた。

## 詳細

### 1. Server Action の正体

`"use server"` の関数はクライアントバンドルに実装が含まれず、**参照 ID** にコンパイルされる。呼び出すと Next.js のクライアントランタイムが現在の URL へ POST を投げ、サーバーはヘッダを見て「レンダリングではなくこの ID の関数を実行する」と判断する。

```js
// node_modules/next/dist/client/components/app-router-headers.js:96
const ACTION_HEADER = 'next-action';

// node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js:47-71
const headers = {
    Accept: RSC_CONTENT_TYPE_HEADER,
    [ACTION_HEADER]: actionId,        // ← 'next-action': <アクションID>
    [NEXT_ROUTER_STATE_TREE_HEADER]: ...
};
const res = await fetch(state.canonicalUrl, {   // ← 素のグローバル fetch
    method: 'POST',
    headers,
    body
});
```

重要な点は 2 つ:

- **read 系も mutation 系も、例外なくこの 1 本の経路を通る**。だから `next-action` ヘッダの有無だけで全 Server Action を取りこぼしなく捕捉できる。
- **`fetch(...)` が裸で書かれている**（モジュール初期化時に `const f = window.fetch` とローカル退避していない）。呼び出しのたびにグローバルを解決するため、後から差し替えたものが効く。

### 2. 失敗を注入するコード

```js
// Next-Action ヘッダ付き POST（= Server Action）だけを reject する
window.__origFetch = window.fetch;
window.fetch = function (input, init) {
  const headers = new Headers((init && init.headers) || (input && input.headers) || {});
  if (headers.has('next-action')) {
    return Promise.reject(new TypeError('Failed to fetch'));
  }
  return window.__origFetch.apply(this, arguments);
};

// 復旧
window.fetch = window.__origFetch;
```

`input` が `Request` オブジェクトの場合はヘッダが `input.headers` 側にあるため、両方を見る。HMR や RSC ナビゲーションの fetch は素通しするので、**開発中の画面を壊さずに狙った瞬間だけ落とせる**。

### 3. 「傍受」ではなく「発射装置ごと差し替え」

これは飛んでいくリクエストを途中で捕まえるのではなく、**リクエストを作る関数自体を置き換えている**。したがって HTTP リクエストは 1 度も作られず、ネットワークに出ない。

原理は vitest の `vi.mock("sonner")` と同じ**スタブ**で、対象がモジュールではなくブラウザのグローバル関数というだけ。

観測結果に違いが出る:

| 観測点 | fetch 差し替え（送信していない） | 本当に送って失敗した場合 |
|---|---|---|
| DevTools の Network タブ | 何も出ない | リクエストが出て失敗表示 |
| サーバー側のログ | 何も残らない | アクセスログ・例外が残る |
| `reportError` の digest | **`undefined`** | サーバー由来の相関 ID が入る |

### 4. 再現できる失敗クラスの限界

この手法が再現するのは **ネットワーク断**であって **DB 障害ではない**。リクエストがサーバーに届く前に落ちるため、サーバー側の例外相関 ID（digest）が存在しない。

- **UI が失敗をどう扱うか**を見るだけなら十分（`callReadAction` から見れば「Promise が reject された」という点で同じ）
- **digest 突き合わせによるサーバーログ追跡**まで検証したいなら、DB を止めるか Server Action に一時的な `throw` を仕込む必要がある

また `next-action` ヘッダで絞っているだけなので、**保存・申請・承認などの mutation 系も巻き添えで落ちる**。read 系だけを狙いたいなら押すボタンを限定するか、`actionId` で絞り込む。

### 5. 他手段との比較

| 手段 | 長所 | 短所 |
|---|---|---|
| **fetch 差し替え** | 狙った瞬間だけ落とせる／HMR・画面遷移を壊さない | ページ再読込で解除／送信自体は発生しない |
| Playwright の `page.route()` | リクエストは実際に作られ、ネットワーク層で abort | セットアップがやや重い |
| DevTools の Offline | JS を触らない | HMR も RSC 遷移も全部死に、切り分けが困難 |
| DB 停止 | digest まで含めて本物に近い | 復旧が面倒／他 worktree に影響 |
| Action に `throw` を仕込む | 特定 Action だけ狙える | コード改変が必要／消し忘れリスク |

### 6. 実際の検証で確認できたこと（PR #634）

トーストの自動消滅（sonner 既定 約4秒）で取り逃さないよう、`MutationObserver` + ポーリングで出現を記録してから操作するのがコツ。

- toast「データの取得に失敗しました。時間をおいて再度お試しください。」の表示
- 確定失敗時にモーダルが**閉じない**こと（`SELECTION_ABORTED` sentinel の効果）
- 検索結果・選択チェックの維持
- 商品 2 件が並列失敗しても **toast は 1 枚**（固定 ID による統合）／**ログは全件**（`reportError` × 5）の非対称
- fetch 復旧後、そのままリトライして成功すること

なお副産物として、検索失敗時は結果が維持される一方で**選択チェックは戻らない**ことが判明した（`handleSearch` が await より前に `setRowSelection({})` を呼ぶため）。これは退行ではなく「新しい検索を始めたら選択を捨てる」という独立した仕様で、ADR 側の文言を実態に合わせる形で決着させた。

## 参考

- `node_modules/next/dist/client/components/app-router-headers.js:96`（`ACTION_HEADER = 'next-action'`）
- `node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js:47-71`（ヘッダ組み立てと `fetch` 呼び出し）
- `src/app/_lib/callReadAction.ts`（read 系 Server Action の共通ラッパー）
- `docs/adr/20260723-h7r-read-action-raw-return-client-wrapper-over-result-envelope.md`（エラーハンドリング方針）
- `.claude/skills/verify-frontend/`（dev server + playwright MCP による実機検証手順）
- PR #634 / Issue #633
