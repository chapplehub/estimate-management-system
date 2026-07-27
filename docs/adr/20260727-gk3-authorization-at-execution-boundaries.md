# ADR-20260727-gk3: 認証・認可の正本を実行境界（page / Server Action）に置き、proxy を前捌きへ降格する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-27 |
| 最終更新日 | 2026-07-27 |

## コンテキスト

ADR-0006 で認可を `src/proxy.ts` の `adminRoutes` 配列に寄せた。その結果、次の 3 つが同時に起きていた。

**1. ページ側に認可が 1 行も無くなった。** `(features)` 配下の `page.tsx` のうち 5 件（`departments/new`・`customers/new`・`roles/new`・`employees/new`・`products/new`）が `verifySession()` すら呼んでいなかった。

**2. 「管理者専用」の定義が 2 箇所に分かれ、2 件ずれた。** `proxy.ts` の `adminRoutes` は `["/employees/new", "/departments/new", "/roles/new"]` の 3 件しか持たず、実際には管理者専用である `/products/new` と `/products/{productCd}/edit` が漏れていた。後者はページ内でインライン判定を自前で書いており、定義が事実上 3 箇所に散っていた。

**3. #644 の静的化バグを招いた。** 動的レンダリングは `verifySession()` の cookie 読み取りという副作用にのみ依存していたため、ページから認可が消えた 5 件はビルド時にプリレンダリングされ、認可は効くのに中身は古い、という状態になった（ADR-0006 の「影響」に記録済み。対症は ADR-20260727-2fb）。

さらに前提として、**Server Action は proxy を通らない**。matcher が `next-action` ヘッダを持つリクエストを除外しているためである（[#25](https://github.com/chapplehub/estimate-management-system/issues/25)）。したがって ADR-0006 が言う「Server Action の `verifyAdmin()` は多層防御として残す」は、実態としては多層ではなく、**アクション側は最初から単層**だった。GET 側は proxy 単層、アクション側は実行境界単層という、防壁が 1 枚ずつ別の場所にある構造になっていた。

問題の根はどこにあったか。ADR-0006 は「**防壁を集約する**」判断だったが、実装は「**防壁を 1 枚だけにする**」帰結になった。この 2 つが区別されていなかった。

## 検討した選択肢

### A. proxy 権威型（不採用）

認証・認可の正本を `proxy.ts` に置き続け、ページ本体の `verifySession()` はむしろ削除していく。ADR-0006 の現状追認。

### B. 実行境界権威型（採用）

正本を各実行境界（page / Server Action / 将来の Route Handler）に置く。`proxy.ts` は未認証アクセスを早期に弾く UX 上の前捌きへ降格し、認可は持たない。

```typescript
// src/app/(features)/products/new/page.tsx
export default async function ProductNewPage() {
  await verifyAdmin();
  // ...
}
```

```typescript
// src/proxy.ts — 認可の分岐は持たない
if (!isPublicRoute && !session) {
  return NextResponse.redirect(new URL(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`, request.url));
}
```

### C. 折衷（認証は proxy、認可は実行境界）（不採用）

認証チェックは proxy が正本、認可チェックだけをページへ移す。

### D. Query / Command への埋め込み（不採用）

Next.js 公式が示す Data Access Layer 流。データ取得の入口そのものが認可を持てば、呼び忘れが原理的に起こらなくなる。

```typescript
// 例: application 層の Query 内で認可する
export class GetAllProductsQuery {
  async execute() {
    await verifySession(); // ← application 層が next/navigation に依存する
  }
}
```

### E. `(features)/layout.tsx` での一括 `verifySession()`（不採用）

レイアウトに 1 箇所書けば配下すべてを守れる。

### F. 呼び忘れの静的検査（ESLint 自前ルール / vitest 静的テスト）（不採用）

`page.tsx` が `verifySession()` 系を呼んでいないことを機械的に検出する。

### G. `proxy.ts` の廃止（不採用）

認可も認証もページが持つなら、proxy 自体を消す。

## 決定

認証・認可の正本を各実行境界（page / Server Action）に置く。`proxy.ts` は未認証アクセスの前捌きに降格し、`adminRoutes` を廃止する。呼び出しはページ本体で直接行い、Query / Command には埋め込まない。

## 根拠

### なぜ実行境界を正本にするか（B / A・C の不採用理由）

既に存在する 2 系統（GET とアクション）を**同じ規則で説明できるのは B だけ**である。A・C は「Server Action は proxy を通らないので例外」という但し書きを永久に抱え、Route Handler を追加するたびに「これは proxy を通るのか」を判断し直すことになる。B なら規則は「実行される場所が自分で確かめる」の一文で足りる。

Next.js 公式の Authentication ガイドも、middleware/proxy での認可は楽観的チェックに留め、*it should not be your only line of defense* としている。この立場は CVE-2025-29927（`x-middleware-subrequest` によるミドルウェア完全バイパス。Next 16 は影響外）**より前から**示されていたもので、CVE はそれを裏付けた形になる。

### なぜ `adminRoutes` を残さないか

残せば「管理者専用」の定義が 2 箇所に居続ける。今回の 2 件のずれ（`products/new`・`products/{productCd}/edit`）は、定義が複数箇所にあったために起きた事故そのものであり、片方を消さない限り同じ形で再発する。廃止すれば定義は「**そのページが `verifyAdmin()` を呼んでいるか**」の 1 箇所に収束する。

ADR-0006 が挙げた利点のうち「ページレンダリング前にブロックできる／不要な DB 問い合わせを避けられる」は、`verifyAdmin()` をページ本体の**先頭**（Query 実行より前）で呼ぶ限りほぼ保たれる。失われるのは、レンダリング開始前のごく僅かな処理だけである。

### なぜ Query / Command に埋め込まないか（D の不採用理由）

D は呼び忘れを原理的に消せる点で最も強い。しかし application 層に `@server/shared/auth` と `next/navigation` への依存を作る。これは ADR-0030（横断的関心事はメソッド引数で渡す）と正面から衝突し、現在 0 件であるこの依存を全面的に持ち込むことになる。**呼び忘れ 5 件のためにレイヤ境界（ADR-0027 / 0030 / 0031 の系譜）を崩すのは釣り合わない。**

なお「実行境界の内側に置いたヘルパー経由で呼ぶ」形は本 ADR に適合する。`resolveOperator()`（`estimate-applications/.../actions.ts`）や `resolveApplicationContext()`（`estimates/[estimateNumber]/actions.ts`）は既にこの形で、Server Action 側の呼び忘れをゼロに保っている。**アクション側に漏れが無かったのは、この束ね方が自然に生まれていたからである。**

### なぜ layout に置かないか（E の不採用理由）

Next.js 公式が Partial Rendering を理由に非推奨としている。レイアウトはナビゲーション時に再レンダリングされないため、ルート遷移ごとの検証にならない。ADR-0006 が挙げた「一覧・詳細は一般ユーザーも見られるので layout で一律チェックはできない」という理由も引き続き有効である。

### なぜ静的検査を入れないか（F の不採用理由）

漏れたときの実害がフォームの露出に留まる（書き込みは Server Action の `verifyAdmin()` が止める）。露出するのも全社員が閲覧してよい社内マスタの入力画面である。ESLint 自前ルール（`Program:exit` で不在を検出する必要がある）の維持コストに見合わない。

### なぜ proxy を消さないか（G の不採用理由）

`publicRoutes` の一覧が「どこが未認証で開けるか」を 1 箇所で示すドキュメント価値を持つ。また未認証アクセスをレンダリング前に弾く UX 上の利点は残る。

## 影響

### proxy に厳密チェックが残ることは「余剰」であって「齟齬」ではない

降格後の proxy の役割（前捌き）から見れば、`getSessionCookie()` による楽観チェックで足りる。現在の `auth.api.getSession()`（DB 検証）はその役割に対して**過剰に安全側へ外れている**だけであり、本 ADR と矛盾しない。prefetch 起因の DB 負荷は未計測のため、実測してから判断する（[#648](https://github.com/chapplehub/estimate-management-system/issues/648)）。`learning/better-auth-proxy-session-validation.md` の選択は撤回されていない。

### 認可失敗（403）の導線は未解決のまま残る

`verifyAdmin()` の既定の遷移先は `/signin?reason=forbidden` であり、**ログイン済みユーザーをサインイン画面へ送っている**。401 と 403 を混同した導線だが、本 ADR の適用範囲は「振る舞いを変えない移設」に限ったため据え置いた。`verifyAdmin(redirectTo?)` の任意引数はこの据え置きのために追加したもので、`products/{productCd}/edit` は従来どおり商品詳細へ戻す。導線の見直しは [#649](https://github.com/chapplehub/estimate-management-system/issues/649)。Next.js の `forbidden()` / `forbidden.tsx` は 16.2 時点でも experimental（`experimental.authInterrupts` が必要）で本番採用できない。

### 新規ページを追加するときの規約

`(features)` 配下に `page.tsx` を追加したら、本体先頭で `verifySession()`（認証のみ）または `verifyAdmin()`（管理者専用）を呼ぶ。**Query 実行より前に置くこと。** 機械的な検査は入れていないため、この規約はレビューで担保する。

### 動的レンダリングとの関係

本 ADR の適用により 5 ページが動的 API を呼ぶようになり、結果として #644 の根本原因も解消される。ただし動的レンダリングの担保は ADR-20260727-2fb（`(features)/layout.tsx` での明示宣言）が本体であり、**認可の有無に依存させない**。この二重化は意図的である。認可を移動するたびにレンダリング特性が変わるようでは、同じ事故が形を変えて再発する。
