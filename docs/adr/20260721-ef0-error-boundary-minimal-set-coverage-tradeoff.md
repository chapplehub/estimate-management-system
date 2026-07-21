# App Router のエラー境界は「global-error＋(features) 直下の error/not-found」の最小セットに絞り、auth・レイアウト・任意 URL は Next デフォルトに落とす

App Router のエラー境界（`error.tsx` / `global-error.tsx` / `not-found.tsx`）を全機能に網羅配置するのではなく、**ルート `global-error.tsx` 1 枚＋ `(features)/error.tsx` 1 枚＋ `(features)/not-found.tsx` 1 枚**の最小セットに絞る。その代償として、`(auth)` 配下の例外・`(features)/layout.tsx`（Header）自体の例外・どのルートにも一致しない任意 URL の 3 経路は、アプリ独自 UI を経由せず Next.js デフォルト画面に落ちることを**意図的に許容する**。#587（PR #586 レビューで判明した、エラー境界が一つも存在しない残課題）で導入する。網羅配置は「境界ファイルが各セグメントに散在し、共通 UI の重複と保守点が増える」コストを負う一方、本システムの通常運用フローは全て `(features)` 配下に集約されており、そこを 1 枚で受ければ実運用のエラー体験は十分カバーできるため、単純さを選ぶ。

## 決定

1. **境界は 3 枚のみ配置する。** `src/app/global-error.tsx`（ルート layout 例外の最終防波堤）、`src/app/(features)/error.tsx`（通常運用の 500 系 UX。Header を layout 側に残し本文だけ差し替え＋再試行）、`src/app/(features)/not-found.tsx`（既存 `notFound()` 23 箇所を一貫 UI 化）。機能セグメント単位の細分化はしない。固有の復旧導線が必要になった時点で、最も近い境界が勝つ App Router の規約に従い後付けする。

2. **意図的なカバレッジの穴を許容する。** `(auth)` 配下の例外と `(features)/layout.tsx` 自体の例外はルートまで上がり `global-error` が受ける（素の全画面差し替え）。任意 URL のグローバル 404 は素の Next デフォルトに落ちる（ルート `app/not-found.tsx` は置かない）。auth は実質 signin 1 画面かつ未ログイン状態で発火頻度が低く、Header 描画例外・URL 打ち間違いも稀なため、これらに丁寧な UI を先回りで用意する費用対効果は低いと判断する。

3. **`global-error` は重い UI 依存を持たず自己完結させる。** `global-error` は最終防波堤であり、共通 `ErrorFallback`／shadcn／フォント等の依存そのものが壊れて例外が出た場合に共倒れしないよう、**外部依存を一切持たず inline style だけで素朴に自前描画する**（`globals.css` も import しない）。理由: `global-error` はルート `layout.tsx` を丸ごと置換するため、`layout.tsx` の `import "./globals.css"` は `global-error` レンダリング時に走らず Tailwind クラスが当たる保証がない。CSS が一切効かなくても文意が壊れない構成にすることで「依存ゼロで単独で必ず描ける」という本決定の趣旨を確実にする。共通化するのは `(features)/error.tsx` 側の薄い `ErrorFallback`（shadcn Card/Button）に限る。

4. **例外のログ接続点は単一の `reportError` シームに隔離する。** 各境界は送り先を直接知らず `reportError(error, context)` を呼ぶだけとし、中身は現状 `console.error`＋`digest`（サーバーログとの相関 ID）に留める。実監視（Sentry 等）の接続は本 issue のスコープ外とし、将来この 1 関数だけを差し替える。

5. **UI に技術詳細を出さず env 分岐もしない。** 表示は固定の汎用日本語メッセージ＋`digest` を「参照 ID」として控えめに出すのみ。`error.message` / stack は UI に一切出さない（本番の機微情報サニタイズは Next の既定挙動に委ね、開発／本番で UI を分岐させない）。

## Considered Options

- **全機能セグメントに境界を網羅配置（不採用）** — カバレッジは最大だが、境界ファイルが散在し共通 UI の重複と保守点が増える。通常運用が `(features)` 集約である本システムでは過剰。
- **ルート `src/app/error.tsx`（中間層）を足す（不採用）** — auth・layout 例外を Toaster/フォント込みの中間 UI で受けられるが、発火頻度の低い経路のために 4 枚目を先回りで持つ費用対効果が低い。必要になれば後付け可能。
- **`global-error` を共通 `ErrorFallback` で描く（不採用）** — 見た目は揃うが、依存が壊れた際に最終防波堤ごと共倒れする。最終防波堤は単独で必ず描けることを優先。
- **今回から実監視 SaaS を接続（不採用）** — DSN 管理・依存追加・別途設計を要し #587 のスコープを超える。issue の要求は「接続点の定義」であってシームで足りる。

## Consequences

- `(auth)` 配下・`(features)/layout.tsx`・任意 URL の 3 経路は当面 Next デフォルト画面のまま。ここを塞ぐ必要が出たら、ルート `error.tsx` ／ ルート `not-found.tsx` を後付けする（本 ADR の割り切りを更新する）。
- 境界が「捕まえること」自体は Next の規約が保証する領域のためテストせず、「捕まえた後に何を描くか」（`ErrorFallback`・`not-found`・`reportError`）のみ RTL の unit テストで検証する。`global-error` は自前 `<html><body>` を描き RTL でのフル render が扱いにくいため、テストは省略する。E2E・発火配線検証は行わない。
- `reportError` に監視を実接続する際は、client 境界の `console.error` がブラウザ側に出る点（server component 由来はサーバーターミナルにも出力され `digest` で相関）を踏まえ、サーバー集約の是非を別途判断する。
