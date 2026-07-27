# Issue #644: DB依存の /new ページ3件がビルド時に静的化され、マスタ更新が反映されない — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

`/departments/new`・`/employees/new`・`/roles/new` がビルド時に静的化され、ビルド時点のマスタが HTML に焼き込まれて配信されている不具合を修正する。

原因は、動的化が「ページ本体で `verifySession()` を呼ぶ → cookie 読み取り → 暗黙的に dynamic 化」という**副作用にのみ依存**していたこと。ADR-0006 で認可を `src/proxy.ts` に寄せた結果、この 3 ページから `verifySession()` が消え、静的化された。`src/app/(features)/` 配下 37 ページのうち `verifySession()` を呼ばない 5 ページと、prerender された 5 ページが完全に一致する。

修正は `src/app/(features)/layout.tsx` に `export const dynamic = "force-dynamic"` を 1 箇所置き、認証配下は動的レンダリングを既定とする。再発防止は #643 の CI build を DB 非到達環境で走らせることで担保する（DB 無しでビルドが通ること自体が「静的化が起きていない」ことの証明になる）。

設計の全文は ADR-20260727-2fb を正とする。

## 設計判断

すべて `/grill-with-docs` セッションで合意済み。ADR-20260727-2fb に記録済み。

### 動的化をどのレイヤで宣言するか
- A. `(features)/layout.tsx` に `export const dynamic = "force-dynamic"` を 1 箇所
- B. 該当 3 ページに個別に宣言する
- C. データアクセス層（QueryService / Server Component）で `connection()` を呼ぶ
- D. ページ本体で `verifySession()` を呼ぶ方針に戻す
- E. `cacheComponents` + `use cache` + `revalidateTag` による明示キャッシュへ移行する
- **決定: A**。全ページが認証必須かつ可変データを表示する社内業務システムであり、静的化の受益者（匿名大量配信）に該当しない。`(features)` 境界が既に「認証が要る領域」と一致しており、新概念を導入せずに保証を貼れる。B は穴が残り次の `/new` で再発、C は infrastructure が `next/server` を import するレイヤリング違反、D は ADR-0006 の巻き戻しかつ暗黙依存の制度化。E は鮮度バグを検出困難なキャッシュ無効化漏れに変換するだけで、かつ全アプリ opt-in のためバグ修正のスコープを超える（別イシューに切り出す）。

### 再発防止をどこまで機械化するか
- A. layout のコメントのみ（人間の注意力に依存）
- B. CI の `next build` を DB 非到達環境で実行する
- C. B + `prerender-manifest.json` の検査スクリプト
- D. ESLint ルール
- **決定: B**。追加コード 0 行。DB を読むページが再び静的化されればビルド時に DB クエリが走って失敗するため、DB 無しでビルドが通ること自体が回帰テストになる。D は検出したいのが「宣言が存在しないこと」で lint 対象に痕跡が残らず無力。C は B との差分が「DB を読まないページの静的化」（実害なし）だけで、Next の内部成果物形式に依存する負債に見合わない。

### ADR の粒度
- A. 1 本にまとめて INDEX の 2 カテゴリに掲載する
- B. 「レンダリング方針」と「CI での担保」で 2 本に分ける
- **決定: A**。担保（CI に DB を与えない）は方針から分離すると意味不明な制約になり、次に CI を触る人が善意で外してしまう。ADR-0000 が複数カテゴリ掲載を正規の運用として認めている。

### 今回の PR のスコープ
- α. 修正 + 文書のみ
- β. α + 戻り値未使用の `verifySession()` を削除して proxy に一本化
- γ. α + 本 PR で CI の build ジョブを追加
- **決定: α**。β は認可の多層防御を削る判断であり #153（認証認可の ADR）の領域。γ は #643 のスコープを食い、ワークフローが二重管理になる。γ を外す代償である「担保が未成立の期間」は、ADR の保留事項と #643 へのコメントで追跡可能にする。

### CONTEXT.md の更新
- **更新しない**。`CONTEXT.md` は見積管理の業務用語集であり、`force-dynamic` / prerender はこのコンテキスト固有のドメイン用語ではない（`CONTEXT-FORMAT.md` の「一般的なプログラミング概念は載せない」に該当）。

## 前提（実測で確認済み）

- Next 16.0.7 / `cacheComponents` 未有効。
- ルートセグメント設定は layout から配下ページへ伝播する。`node_modules/next/dist/build/get-static-info-including-layouts.js` がページのディレクトリから `appDir` まで遡って全 `layout.*` を収集し、`reduceAppConfig`（`utils.js:828`）で畳み込む。ルートグループ `(features)` は実ディレクトリなので遡上に含まれる。
- `reduceAppConfig` は**後勝ち**のため、個別ページが `force-static` で上書きできる。A は「既定」であって「施錠」ではない。この非対称性が Step 3 の担保を必要にしている。
- 焼き込まれた古い ID で submit されてもデータ破壊には至らない（Server Action の `verifyAdmin()` → conform/zod → Command → FK 制約の多層防御）。実害は表示の鮮度に限られる。

## ステップ

### Step 1: ADR の追加と ADR-0006 への追記をコミットする
- [x] **完了**
- 対象ファイル:
  - `docs/adr/20260727-2fb-explicit-dynamic-rendering-for-authenticated-routes.md`（新規・作成済み）
  - `docs/adr/INDEX.md`（2 カテゴリに追記・変更済み）
  - `docs/adr/0006-admin-route-protection-in-proxy.md`（「影響」に副作用を追記・変更済み）
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - `/grill-with-docs` セッションで作成済みの 3 ファイルをコミットする（内容の追加作業は不要）
  - ADR-0006 は差替ではない。「認可を proxy に置く」判断は引き続き有効で、副作用として静的化を招いた事実のみを追記している
- コミットメッセージ: `docs: 認証配下ルートの動的レンダリング方針を ADR-20260727-2fb として記録する`

### Step 2: (features) レイアウトで動的レンダリングを既定宣言する
- [x] **完了**（`pnpm build` 実測: `prerender-manifest.json` の `routes` は
  `["/_global-error","/_not-found","/signin","/favicon.ico","/"]` のみ。`new.html` は 0 件）
- 対象ファイル: `src/app/(features)/layout.tsx`
- テスト戦略: テスト不要（レンダリング設定。ユニットテストでも E2E でも検出できない — dev サーバは常に動的に動くため。検証はビルド成果物の観測に依存し、その常設化が #643 側の担保にあたる）
- 作業内容:
  - `export const dynamic = "force-dynamic";` を追加する
  - **なぜこの 1 行が必要か**を説明するコメントを併記し、ADR-20260727-2fb を参照させる。「消せば速くなるのでは」と善意で削除される事故を防ぐことがコメントの目的
  - 手動検証: `pnpm build` 後に `.next/prerender-manifest.json` の `routes` から `/departments/new`・`/employees/new`・`/roles/new`・`/customers/new`・`/products/new` が消えていること、`.next/server/app/**/new.html` が生成されていないことを確認する
  - 併せて `/` と `/signin`（`(features)` の外）が静的なまま残っていることも確認する
- コミットメッセージ: `fix: 認証配下ルートの動的レンダリングを (features) レイアウトで既定宣言する`

### Step 3: 担保を #643 へ申し送り、Issue を本化する
- [ ] **完了**
- 対象ファイル: なし（GitHub 上の操作）
- テスト戦略: テスト不要（Issue 運用）
- 作業内容:
  - #643 にコメントする: 「ADR-20260727-2fb がこの CI に依存している。build ジョブに DB を与えないこと。`DATABASE_URL` 未定義だと `src/server/prisma.ts` の `PrismaPg` 構築（モジュール評価時）で落ちて失敗の意味がブレるため、**到達不能だが形式は正しいダミー接続文字列**を置く。これにより『ビルド失敗＝静的化の発生』と一意に読める」
  - #644 の本文を本化する: 「未決事項 / 要調査」のチェックリストを確定した決定内容で置き換え、ADR-20260727-2fb を参照させる。`Status: draft` ラベルを外す
  - E（`cacheComponents` + `use cache` による静的シェルの追求）を別イシューとして起票する
- コミットメッセージ: なし（コミット対象なし）

## 残課題（本 Issue のスコープ外）

- **担保は #643 の着地まで未成立**。本 PR マージ後、#643 が入るまで「修正だけが入って番人が不在」の期間が存在する。ADR の保留事項に記載済み
- **ページ本体の `verifySession()` の整理**（戻り値未使用の 32 ページ分）は #153 の領域。動的化には寄与しなくなるが、認可の多層防御としては引き続き有効
- **`/customers/new`・`/products/new`** は DB を読まないため、将来静的化に戻っても DB 非到達 build では検出されない。実害がないため許容する
