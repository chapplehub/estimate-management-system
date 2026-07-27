# Issue #153: 認証・認可の責務を実行境界に一本化し、proxy を前捌きへ降格する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

認証・認可の正本を `src/proxy.ts` から**各実行境界（page / Server Action）**へ移す。

ADR-0006 が認可を proxy に寄せた結果、(1) ページ側に認可が 1 行も無い、(2) 「管理者専用」の定義が proxy の `adminRoutes` と Server Action の `verifyAdmin()` の 2 箇所に分かれて 2 件ずれている、(3) `verifySession()` を呼ばないページが 5 件ある（#644 の静的化バグの直接原因）、という状態になっている。加えて Server Action は matcher の `next-action` 除外（#25）により proxy を通らないため、ADR-0006 が言う「多層防御」は GET 側にもアクション側にも成立していない。

本計画では ADR-0006 を差し替え、ページ本体に `verifySession()` / `verifyAdmin()` を置いて `adminRoutes` を廃止する。**認可失敗時の遷移先は `verifyAdmin(redirectTo?)` の任意引数で完全に据え置く**ため、対象 6 ページの振る舞いはユーザーから見て一切変わらない。

作業順序に意味がある。**防壁を減らす Step 3 は、代替が入り切った Step 2 の後に置く。**中間コミットが単独で存在しうる以上（revert・二分探索）、順序は成果物の一部である。

## 設計判断

会話（`/grill-with-docs`）で確定済み。ADR は Step 4 で起票する。

### 責務配置モデル
- A. proxy 権威型（現状追認・ページ側の `verifySession()` は削除可）
- B. 実行境界権威型（正本は page / Server Action。proxy は前捌き）
- C. 折衷（認証は proxy、認可は実行境界）
- **選択: B**。理由: 既に存在する 2 系統（GET と Server Action）を同じ規則で説明できるのは B のみ。A・C は「Server Action は例外」という但し書きを永久に抱え、Route Handler 追加時に再び判断が要る。Next.js 公式ガイドの立場（*it should not be your only line of defense*）とも一致する。
- **帰結**: ページ本体の `verifySession()` は削除対象ではなく追加対象になる（#647 の想定と逆）。

### 呼び出しの置き場所
- A. ページ本体で直接呼ぶ
- B. Query/Command へ埋め込む（Next.js 公式 DAL 流。呼び忘れが原理的に不可能になる）
- **選択: A**。理由: B は application 層に `@server/shared/auth` と `next/navigation` への依存を作り、ADR-0030（横断的関心事はメソッド引数で渡す）と正面衝突する。現在この依存は 0 件。呼び忘れ 5 件のためにレイヤ境界（ADR-0027 / 0030 / 0031 の系譜）を崩すのは釣り合わない。
- 「実行境界内のヘルパ経由」は適合とする（既存の `resolveOperator()` / `resolveApplicationContext()` はこの形で呼び忘れゼロを達成している）。

### 呼び忘れの静的検査
- A. ESLint 自前ルール（`Program:exit` で不在を検出）
- B. vitest による静的検査テスト
- C. 導入しない
- **選択: C**。理由: 漏れたときの実害がフォーム露出に留まり（書き込みは Server Action が守る）、露出するのも全社員が閲覧してよい社内マスタであるため、機構のコストに見合わない。

### 管理者ルート認可の置き場所
- A. ページの `verifyAdmin()` に一本化し、`proxy.ts` の `adminRoutes` を廃止
- B. ページに追加しつつ `adminRoutes` も残す（二重管理・二重防壁）
- **選択: A**。理由: 管理者専用ルートの定義が「そのページが `verifyAdmin()` を呼んでいるか」の 1 箇所になる。今回の 2 件のずれ（`products/new`・`products/[productCd]/edit` が `adminRoutes` に無い）は、定義が 2 箇所にあったことで生じた事故そのもの。ADR-0006 の利点（レンダリング前ブロック・不要な DB 問い合わせの回避）は、`verifyAdmin()` をページ**先頭**で呼ぶ限りほぼ保たれる。

### 認可失敗時の遷移先
- A. `verifyAdmin()` に統一（`products/[productCd]/edit` の遷移先が `/products/{cd}` → `/signin` に退化）
- B. `verifyAdmin(redirectTo?)` に拡張し、既定は現状据え置き
- C. 403 導線そのものを見直す（ログイン済みユーザーを signin へ送るのをやめる）
- **選択: B**。理由: 本イシューを「振る舞いを一切変えない移設」として着地させられる。C は妥当だが #153 が移設から UX 変更に膨らむため #649 に分離。Next.js の `forbidden()` は 16.2 時点でも experimental・本番非推奨のため採れない。

### `proxy.ts` の実装変更
- A. 本イシューで `getSessionCookie`（楽観チェック）へ切り替える
- B. ADR で役割を降格定義するに留め、実装は据え置く
- **選択: B**。理由: 降格後の役割から見て、proxy に厳密チェックが残ることは**余剰であって齟齬ではない**（安全側に外れている）。加えて prefetch 起因の DB 負荷は未計測。#648 で測ってから決める。

### ADR の構成
- A. 新規 1 本にまとめ、ADR-0006 は「差替」
- B. ADR-0006 に追記して改訂扱い
- C. 2 本に分ける（責務配置モデル／管理者ルート移設）
- **選択: A**。理由: `adminRoutes` 配列自体が消えるため ADR-0006 の決定は一片も残らず、追記だと「決定は proxy、ただし実装には無い」という読めない文書になる。C は `adminRoutes` を消す判断が責務配置モデルを読まないと「なぜ防壁を減らすのか」と誤読されるため退けた（#647 の D3 と同じ理由）。

### 用語
- `session.user.role`（admin/user）は `CONTEXT.md` の「役割」（承認チェーンの部長・課長）と**無関係な直交軸**。同じ `role` の語が 2 概念を指していたため、`CONTEXT.md` に「システム権限」を 1 項目追加して衝突を解消済み（Step 4 でコミット）。

## ステップ

### Step 1: `verifyAdmin` / `verifyOwnerOrAdmin` に遷移先の任意引数を足す
- [x] **完了**
- 対象ファイル:
  - `src/app/_lib/verifyAuthentication.ts`
  - `src/app/_lib/__tests__/verifyAuthentication.test.ts`（新規）
- テスト戦略: TDD
- 作業内容:
  - `verifyAdmin(redirectTo?: string)` / `verifyOwnerOrAdmin(resourceOwnerId, redirectTo?)` に任意引数を追加する。既定値は現状の `/signin?reason=${REDIRECT_REASON.FORBIDDEN}` を維持し、**既存の全呼び出し箇所を無変更で通す**
  - テストは「期待する振る舞いを実装前に言い切れる」型のため先に書く。検証する振る舞い:
    - 管理者セッションではリダイレクトせずセッションを返す
    - 非管理者かつ `redirectTo` 未指定なら `/signin?reason=forbidden` へリダイレクトする
    - 非管理者かつ `redirectTo` 指定ありならその値へリダイレクトする
    - `verifyOwnerOrAdmin` は本人・管理者いずれでも通し、どちらでもなければリダイレクトする
  - モックは既存の `src/app/(features)/estimates/_shared/__tests__/selling-price-actions.test.ts` の流儀に合わせる（`@/app/_lib/verifyAuthentication` ではなく、ここでは `@server/shared/auth` と `next/navigation` をモックする）
- コミットメッセージ: `refactor: verifyAdmin に認可失敗時の遷移先を任意指定できるようにする`
  - ボディに記載する設計判断: 既定値を据え置く理由（本イシューを振る舞い不変の移設として着地させるため。403 導線の見直しは #649）

### Step 2: 管理者専用 5 ページと `customers/new` に実行境界の認証・認可を置く
- [ ] **完了**
- 対象ファイル:
  - `src/app/(features)/departments/new/page.tsx`
  - `src/app/(features)/roles/new/page.tsx`
  - `src/app/(features)/employees/new/page.tsx`
  - `src/app/(features)/products/new/page.tsx`
  - `src/app/(features)/products/[productCd]/edit/page.tsx`
  - `src/app/(features)/customers/new/page.tsx`
- テスト戦略: テスト不要（proxy による同等の認可が並存する期間であり振る舞い不変。実効の確認は Step 3 の E2E で行う）
- 作業内容:
  - 管理者専用 4 ページ（`departments/new`・`roles/new`・`employees/new`・`products/new`）の**本体先頭**に `await verifyAdmin()` を追加する。Query 実行前に置くこと（ADR-0006 の「不要な DB 問い合わせを防ぐ」利点を保つため）
  - `products/[productCd]/edit/page.tsx` のインライン判定（`const session = await verifySession()` ＋ `if (!isAdmin(session)) redirect(...)`）を ``await verifyAdmin(`/products/${productCd}`)`` に置換する。未使用になる `isAdmin` / `redirect` / `verifySession` の import を整理する
  - `customers/new/page.tsx` に `await verifySession()` を追加する（Server Action が `verifyAdmin` を要求しないため管理者不要）
  - この時点で proxy の `adminRoutes` と二重になるが、**多いほうへ倒れる**ため安全
- コミットメッセージ: `refactor: 管理者専用ページと customers/new の認証・認可をページ本体へ移す`
  - ボディに記載する設計判断: 実行境界権威型の採用理由と、`products/[productCd]/edit` で遷移先を明示指定して挙動を保存していること

### Step 3: `proxy.ts` から `adminRoutes` を削除する
- [ ] **完了**
- 対象ファイル:
  - `src/proxy.ts`
  - `src/app/(features)/products/products-crud.e2e.ts`
- テスト戦略: 実装後テスト（E2E）
- 作業内容:
  - `proxy.ts` から `adminRoutes` 定数と管理者判定の分岐、不要になった `isAdmin` の import を削除する。残るのは認証チェックのみ
  - `products-crud.e2e.ts` の一般ユーザーシナリオ（現状 `/products/new` を開いてフォーム送信で拒否される前提、L232 付近・L260 付近・L271 付近）を「**ページを開いた時点で弾かれる**」前提へ修正する。Server Action 側の `verifyAdmin` を検証していたケースが消える場合は、その保証がどこに移ったかをコメントで明示する
  - 一般ユーザーで管理者専用 5 ページを開いて弾かれることを E2E で確認する。**この 5 ページの防壁が今コミットでページ側のみになるため、ここが実効の確認点**
  - 実行は変更に関係するスペックのみに絞る（全体は CI に任せる）
- コミットメッセージ: `refactor: 管理者専用ルートの認可を proxy から外し実行境界へ一本化する`
  - ボディに記載する設計判断: 代替の防壁が前コミットで全ページに入っていること（このコミットを単独で読んだ人が「防壁を消しただけの変更」と誤読しないため）。`adminRoutes` の 2 件のずれが、定義が 2 箇所にあったことで生じた事故であること

### Step 4: ADR の起票と関連文書の更新
- [ ] **完了**
- 対象ファイル:
  - `docs/adr/20260728-{sss}-{slug}.md`（新規。`sss` は base36 3桁ランダム。`ls docs/adr/` で衝突がないことを確認する）
  - `docs/adr/0006-admin-route-protection-in-proxy.md`
  - `docs/adr/INDEX.md`
  - `learning/better-auth-proxy-session-validation.md`
  - `CONTEXT.md`（編集済み・未コミット）
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 新 ADR を `docs/adr/TEMPLATE.md` の構成で書く。責務配置モデルと管理者ルート移設を**1 本にまとめる**。「検討した選択肢」に不採用案を記載する:
    - proxy 権威型 / 折衷（Server Action が例外として残り続ける）
    - Query/Command への埋め込み（ADR-0030 と衝突）
    - `(features)/layout.tsx` での `verifySession()`（Next.js 公式が Partial Rendering を理由に非推奨。layout はナビゲーションで再レンダリングされない）
    - `forbidden()` / `forbidden.tsx`（Next 16.2 時点でも experimental・本番非推奨 → #649）
    - `proxy.ts` の廃止（public/protected 一覧のドキュメント価値を失う）
    - 呼び忘れの静的検査（実害に対してコスト過大）
  - 「影響」に記載する: `proxy.ts` に厳密チェックが残ることは**余剰であって齟齬ではない**こと（#648 で実測してから判断）、および 403 導線が未解決であること（#649）
  - ADR-0006 のステータスを `差替（→ ADR-20260728-{sss}）` に更新する。**#647 が「影響」に追記した副作用の記録（#644 が起きた理由）はそのまま残す**
  - `INDEX.md` の「アプリケーション（フロントエンド・認可）」に新 ADR を追記し、0006 のステータスを更新する
  - `learning/better-auth-proxy-session-validation.md` に追記する: この選択は proxy を正本とする意味ではない／正本は実行境界／ここでの厳密チェックは余剰であり #648 で見直す
  - `CONTEXT.md` の「システム権限」追加（編集済み）をこのコミットに含める
- コミットメッセージ: `docs: 認証・認可の責務配置を ADR に記録し ADR-0006 を差替にする`
  - ボディに記載する設計判断: ADR を 1 本にまとめた理由（`adminRoutes` を消す判断は責務配置モデルと分離すると誤読されるため）、ADR-0006 を追記でなく差替とした理由（決定が一片も残らないため）

## 受け入れ条件

- [ ] `src/app/(features)` 配下の全 `page.tsx` が `verifySession()` または `verifyAdmin()` を呼んでいる
- [ ] 管理者専用 5 ページがページ本体で `verifyAdmin()` を呼んでいる
- [ ] `src/proxy.ts` に `adminRoutes` が存在しない
- [ ] 対象 6 ページの認可失敗時の遷移先が変更前と一致する（`products/[productCd]/edit` は `/products/{productCd}`、他は `/signin?reason=forbidden`）
- [ ] ADR-0006 のステータスが「差替」になっている
- [ ] `pnpm test` と型チェックが通る

## スコープ外

- **#648** proxy のセッション検証を楽観チェック（`getSessionCookie`）へ落とすか、実測して判断する
- **#649** 認可失敗（403）時にログイン済みユーザーを signin へ送っている導線を見直す
