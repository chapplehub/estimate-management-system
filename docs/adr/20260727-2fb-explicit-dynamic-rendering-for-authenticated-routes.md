# ADR-20260727-2fb: 認証配下ルートの動的レンダリングを (features) レイアウトで既定宣言し、DB 非到達ビルドで担保する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-27 |
| 最終更新日 | 2026-07-27 |

## コンテキスト

DB からマスタを読む `/new` ページ 3 件（`/departments/new`・`/employees/new`・`/roles/new`）がビルド時に静的化（prerender）され、ビルド時点のマスタが HTML に焼き込まれたまま配信されていた（#644）。以降マスタを更新しても、再ビルドするまで画面のセレクトボックスに反映されない。

### 観測された事実

- `.next/prerender-manifest.json` の `routes` に該当 3 ルートが載り、`initialRevalidateSeconds: false`（＝再検証なし＝恒久的にビルド時の値）。
- `.next/server/app/{departments,employees,roles}/new.html` が実在し、`<option value="019f91aa-...">営業部</option>` のようにマスタの実データが埋め込まれていた。E2E シードの「E2E専用_…」まで焼き込まれていた。
- `/estimates/new`・`/delivery-locations/new` には `.html` が生成されていない（動的）。

### 原因

`src/` 全体に `export const dynamic` / `revalidate` / `unstable_noStore` は 1 件も存在せず、**動的化は「ページ本体で `verifySession()` を呼ぶ → Better Auth が cookie を読む → 暗黙的に dynamic 化」という副作用にのみ依存していた**。

この構造は観測で裏づけられる。`src/app/(features)/` 配下 37 ページのうち `verifySession()` を呼ばないのは 5 ページ（`customers/new`・`departments/new`・`employees/new`・`products/new`・`roles/new`）だけで、これが prerender された 5 ページと**完全に一致する**。

該当 3 ページから `verifySession()` が消えたのは、ADR-0006 で認可を `src/proxy.ts` の `adminRoutes` に寄せた結果である。proxy は毎リクエスト走るためアクセス制御自体は正しく効いていたが、**proxy はレンダリングのキャッシュ判定に一切関与しない**ため、認可は効くのに中身は古い、という状態になった。

### 前提の変化

Next.js の App Router は「既定で静的、動的 API の使用を検出したら動的」である。Prisma 呼び出しは Next にとって単なる非同期関数なので、DB を読むだけの Server Component は「静的化してよいもの」と判定される。Pages Router 時代であれば全ページ `getServerSideProps` で誰も疑問を持たなかったものが、**「動的であるべき」が明示を要する側に回った**ことで生じた事故である。

なお、焼き込まれた古い ID で submit された場合のデータ整合は多層で守られている（Server Action の `verifyAdmin()` → conform/zod → Command → FK 制約）。本件の実害は表示の鮮度に限られ、データ破壊には至らない。

## 検討した選択肢

### A. `(features)/layout.tsx` に `export const dynamic = "force-dynamic"` を 1 箇所置く（採用）

```ts
// src/app/(features)/layout.tsx
export const dynamic = "force-dynamic";
```

ルートセグメント設定は配下の全ページへ伝播する。認証配下の全ページが動的になり、認証不要な `/`（`src/app/page.tsx`）と `/signin`（`src/app/(auth)/`）は `(features)` の外にあるため静的なまま残る。

### B. 該当 3 ページに個別に `force-dynamic` を書く（不採用）

修正範囲は最小だが、構造的な穴が残る。次に作られる `/new` ページで同じ事故が再発する。「開発者が毎回思い出す」ことに依存する規約は、#644 が示したとおり機能しない。

### C. データアクセス層（QueryService / Server Component）で `connection()` を呼ぶ（不採用）

「DB を読む経路は必ず動的」を構造的に保証でき、カバー範囲としては最も正確。しかし infrastructure 層が `next/server` を import することになり、DDD のレイヤリング規約（CLAUDE.md「Domain layer MUST NOT import Prisma, Next.js...」と同じ思想）に反する。レンダリング戦略という presentation の関心事を永続化層に持ち込む代償が、得られる正確さに見合わない。

### D. ページ本体で `verifySession()` を呼ぶ方針に戻す（不採用）

ADR-0006 の判断を実質的に巻き戻す。認可が proxy とページの二重管理になり、かつ「認証の副作用で動的化する」という**暗黙依存そのものを制度化してしまう**。今回是正したい構造を追認する選択肢であり採らない。

### E. `cacheComponents` を有効化し `use cache` + `revalidateTag` で明示キャッシュへ移行する（今回は見送り・別イシュー）

Next 16 が向かっている方向であり、「マスタは滅多に変わらないのだから毎リクエスト引くのは無駄」という直感を鮮度を犠牲にせず実装できる唯一の案。静的シェル＋動的な穴という粒度も得られる。

見送る理由は、**バグの性質を変えるだけだから**である。E は「レンダリングの鮮度問題」を「キャッシュ無効化の呼び忘れ問題」に変換する。`revalidateTag` の呼び忘れは #644 と同型のバグでありながら、`.next/prerender-manifest.json` のような静的な物証が残らず検出がより困難になる。マスタ更新は管理者が日常的に行う操作であり失敗頻度も高い。数ミリ秒のために、検出困難な鮮度バグの再発可能性を買う取引になる。加えて `cacheComponents` は全アプリ opt-in でセマンティクスが全ルートで変わるため、バグ修正 1 件のスコープに収まらない。

### 再発防止策の比較

| 案 | 追加コスト | 検出範囲 | 採否 |
|---|---|---|---|
| 何もしない（layout のコメントのみ） | 0 | 人間の注意力のみ | 不採用 |
| CI の build を DB 非到達環境で実行 | 0（#643 側の設定のみ） | DB を読むページの静的化 | 採用 |
| `prerender-manifest.json` の検査スクリプト | スクリプト＋CI ステップ | `(features)` 配下の全ページ | 不採用 |
| ESLint ルール | ルール実装 | ほぼ無し | 不採用 |

ESLint を退けたのは、検出したいのが「宣言が**存在しない**こと」であり、lint 対象ファイルに何の痕跡も残らないためである。lint は「書かれたコードの誤り」は見つけられるが「書かれなかったコード」は見つけられない。

manifest 検査スクリプトを退けたのは、DB 非到達 build との差分が「DB を読まないページの静的化」（`/customers/new`・`/products/new`）だけであり、それらは静的化しても実害がないため。Next の内部成果物の形式に依存する負債を、実害のない差分のために抱える取引にはならない。

## 決定

**A を採用する。** 認証配下（`src/app/(features)/`）は動的レンダリングを既定とし、`(features)/layout.tsx` で 1 箇所だけ宣言する。静的化を許すのは認証不要な `/` と `/signin` のみ。

**担保として、CI の `next build` を DB に到達できない環境で実行する。** `(features)` 配下の DB を読むページが再び静的化されればビルド時に DB クエリが走って失敗するため、**DB 無しでビルドが通ること自体が「静的化が起きていない」ことの証明**になる。

## 根拠

### 静的化の受益者にこのシステムは該当しない

Next.js の静的化が想定する受益者は「匿名ユーザーに同一の HTML を大量配信するサイト」（マーケティングサイト・ドキュメント・ブログ・EC の商品ページ）である。本システムは全ページが認証必須で、全ページが可変のマスタ／トランザクションデータを表示する社内業務システムであり、このカテゴリに属さない。

したがって本件は「静的にできたものを動的にする」判断ではなく、**「静的にしてはいけないものが事故で静的になっていたのを是正する」判断**である。静的化の対価は鮮度であり、それが正当なのは「その HTML が全ユーザー・全時点で同じでよい」ときに限られる。マスタのセレクトボックスはこの条件を満たさない。

### 失うものはルート単位の HTML キャッシュのみ

`force-dynamic` で放棄されるのは「ルート単位の HTML をビルド時に生成してキャッシュすること」だけで、Client Component のバンドル最適化、静的アセット、RSC の「サーバのみ実行・JS を送らない」利点、React Compiler の最適化はすべて残る。

上乗せされるリクエストごとのコストは RSC ツリーの再レンダリング分だが、**このページは正しい画面を出すためにどのみちマスタを読まねばならず、DB クエリは削れない**。社内数十人規模の利用で観測に出る差ではない。

### 境界が既存構造と一致している

`(features)` ルートグループは既に「認証が要る領域」と一致しており、新しい概念を導入せずに保証を貼れる。B・C・D はいずれも「開発者が思い出す」か「レイヤを汚す」かのどちらかを要求する。

### 担保が「楽をする選択」と一致している

A の適用後、ビルドから DB 依存が落ちる。#643（CI に lint / 型 / テスト / build を追加する）にとって「CI に DB を用意しなくてよい」は純粋な利得であり、**その楽をする選択がそのまま回帰テストになっている**。制約を課すことで検証が生まれる関係であり、逆に CI へ DB を置いてしまうとこの情報は永久に失われる。

### 伝播の機構（実測で確認済み）

`node_modules/next/dist/build/get-static-info-including-layouts.js` が、ページのディレクトリから `appDir` まで遡って全ての `layout.*` を収集し、`reduceAppConfig`（`node_modules/next/dist/build/utils.js`）で畳み込む。ルートグループ `(features)` はディスク上の実ディレクトリなので、この遡上に含まれる。

```js
// reduceAppConfig: segments = [最外 layout, ..., 最内 layout, page]
for (const segment of segments) {
  if (typeof dynamic !== 'undefined') config.dynamic = dynamic;   // 後勝ち
}
```

## 影響

- **これは「既定」であって「施錠」ではない。** `reduceAppConfig` は後勝ちのため、個別ページが `export const dynamic = "force-static"` を書けば layout の宣言を上書きできる。この非対称性ゆえに、宣言とは独立した観測点（DB 非到達 build）が必要になる。
- **CI の build に DB を与えてはならない。** これが担保の本体である。`DATABASE_URL` を未定義にすると `src/server/prisma.ts` の `PrismaPg` 構築（モジュール評価時）で落ちて失敗の意味がブレるため、**到達不能だが形式は正しいダミー接続文字列**を置く。そうすれば「構築は通る／クエリを投げた瞬間に落ちる」となり、ビルド失敗＝静的化の発生、と一意に読める。
- **`(features)` の外に認証必須ページを作る場合は、同じ宣言が別途必要になる。** 現時点で `(features)` の外にあるのは `/`（create-next-app のテンプレページ）と `/signin` のみで、いずれも静的で問題ない。
- **`/customers/new`・`/products/new` も併せて動的になる。** DB を読まないため実害はなかったが、`(features)` 配下なので一括で揃う。ただし DB を引かないため、これらが将来静的化に戻っても DB 非到達 build では検出されない。
- **ページ本体の `verifySession()` は動的化に寄与しなくなる。** 32 ページの既存呼び出しは認可の多層防御として引き続き有効であり、本 ADR では手を入れない（ADR-0006 が Server Action の `verifyAdmin()` を多層防御として残す判断と同じ思想）。整理の要否は #153 で扱う。
- **本修正には自動テストが付かない。** ユニットテストでも E2E でも検出できない（dev サーバは常に動的に動くため）。検証はビルド成果物の観測に依存し、その常設化が #643 である。

## 保留事項

### 1. 担保は #643 の着地まで未成立

本 ADR の再発防止は CI の DB 非到達 build に依存するが、#643 は未着手である。したがって本 ADR 採用時点では**修正だけが入って番人が不在**の期間が存在する。#643 側に「本 ADR がこの CI に依存している／build ジョブに DB を与えないこと」を申し送る。

### 2. E（`cacheComponents` + `use cache`）への移行

静的シェルの追求は別イシューとして切り出す。移行する場合は `(features)/layout.tsx` の 1 行を外すところから始められるため、本 ADR は E への障害にならない。移行時は本 ADR を「差替」にする。検討の前提として、#643 の CI が固まり `revalidateTag` の呼び忘れを検出する手段の目処が立っていることを条件とする。

## 関連

- ADR-0006（管理者専用ルートの認可チェックを proxy.ts で行う。この 3 ページから `verifySession()` が消えた経緯。差替ではなく、0006 の判断は引き続き有効）
- #644（本 ADR の起票元。DB 依存の `/new` ページ 3 件がビルド時に静的化される不具合）
- #643（CI に lint / 型チェック / ユニットテスト / build を追加する。本 ADR の担保の置き場）
- #153（認証認可にかかわる ADR の作成を検討する。ページ本体の `verifySession()` 整理はこちらの領域）
- `node_modules/next/dist/build/get-static-info-including-layouts.js` / `utils.js` の `reduceAppConfig`（layout からの伝播と後勝ちの機構）
