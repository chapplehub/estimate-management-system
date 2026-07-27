# Issue #153: /auto-review-fix ラウンド 1 修正計画

`/code-review medium`（対象 `develop...HEAD`）→ judge 評価の結果、**採用①② 0 件・採用③ 6 件**。
コード挙動に触れる修正は無く、6 件すべて「コメント／JSDoc が本 PR の決定と食い違っている」型の cleanup。

> **収束状況**: 採用①②が 0 件のため、このラウンドで③を処理したら Phase 6（完了サマリ）へ進む。

## 通底する問題

本 PR は「認可の正本を proxy から実行境界へ移す」責務モデルの変更である。**実装は移設し切っているが、「なぜそのコードがそこにあるか」を説明する文が旧モデルのまま各所に残った**。
本 PR 自身が `employees-crud.e2e.ts:269` のコメントを同じ理由で修正し `deviations.md` §2 に逸脱記録までしているため、**同じ基準を残りにも適用する**のがこの修正の主旨。

---

## R1-1 | ③ cleanup | severity参考: Medium

- **file:line**: `src/app/_lib/verifyAuthentication.ts:9`, `:18`
- **問題**: 旧「proxy 権威型」を前提にしたコメントが残存し、同 PR が `src/proxy.ts:8-13` に新規に書いた説明と正面から矛盾する。
  - L9「proxy を通過後のページ・Server Action から呼び出す。」
  - L18「// proxy を通過しているはずなので、ここに来るのは異常系」
  - Server Action は matcher の `next-action` 除外（#25）で proxy を通らないため、アクション経路では L18 は成立しない。実行境界権威型では `verifySession()` が正本＝唯一の防壁であり、失効セッションの到達は**通常系**。
- **修正方針**: 実行境界権威型の記述へ差し替える。ADR-20260727-gk3 が書き直しの内容を明文で与えているため文言の判断余地は無い。
  - L9 → 呼び出し元（page / Server Action）が認証の正本であること、proxy は前捌きにすぎないことを書く
  - L18 → 「異常系」の断定をやめ、Server Action 経路では proxy を通らないため通常の一次チェックである旨に直す
- **影響範囲**: `src/app/_lib/verifyAuthentication.ts` のみ。コメントのみで挙動不変
- **想定テスト**: 既存 `src/app/_lib/__tests__/verifyAuthentication.test.ts`（9 件）が緑のまま

## R1-2 | ③ cleanup | severity参考: Low

- **file:line**: `src/app/_lib/verifyAuthentication.ts:31`, `:50`
- **問題**: JSDoc 概要行「管理者でない場合は FORBIDDEN でリダイレクト。」「どちらでもない場合は FORBIDDEN でリダイレクト。」が無条件の断定のままだが、本 PR の `redirectTo` 追加で FORBIDDEN 以外へ飛ぶ経路ができた（`products/[productCd]/edit/page.tsx:14` が `/products/{cd}` を渡す。reason なし＝トーストも出ない）。直下に追記した `@param`（「省略時はサインインページ」）と**同一 JSDoc 内で矛盾**している
- **修正方針**: 「**省略時は** FORBIDDEN でリダイレクト」と限定を入れる。直下の `@param` の文言と一意に整合する
- **影響範囲**: 同ファイルのみ。挙動不変
- **想定テスト**: 同上

## R1-3 | ③ cleanup | severity参考: Medium（**最優先**）

- **file:line**: `src/app/(features)/products/products-crud.e2e.ts:264`
- **問題**: 本 PR が新規に書いたコメントが実在しないファイルを指す。「（**products/actions.ts** の createProduct）」とあるが `src/app/(features)/products/actions.ts` は存在せず、実体は `src/app/(features)/products/new/actions.ts`。しかも `src/app/(features)/products/[productCd]/actions.ts` という**別の実在ファイル**があるため、単なる誤りでなく誤誘導になる
- **修正方針**: `products/new/actions.ts` に訂正する（1 語）
- **影響範囲**: E2E コメントのみ。テストコードは無変更
- **想定テスト**: 変更なし（コメント）

## R1-4 | ③ cleanup | severity参考: Low

- **file:line**: `src/proxy.ts:5-15`
- **問題**: 本 PR が新規追加した「未認証アクセスの前捌き」JSDoc が、`proxy()` 関数ではなく直後の `const publicRoutes = [...]` に付いている。ブロック末尾「認可（管理者判定）はページ本体の verifyAdmin() が担う」は明らかに関数／モジュールの責務説明であり、定数の説明ではない。IDE のホバーでは「publicRoutes = 未認証アクセスの前捌き」と表示される
- **修正方針**: JSDoc を `export async function proxy` の直上へ移す
- **影響範囲**: `src/proxy.ts` のみ。挙動不変
- **想定テスト**: 変更なし（コメント位置）

## R1-5 | ③ cleanup | severity参考: Low

- **file:line**: `src/app/_lib/verifyAuthentication.ts:52`
- **問題**: `@param resourceOwnerId - リソース所有者の**ユーザーID**` だが、`isOwner`（`src/server/shared/auth/verify/authorization.ts:63-65`）は `session.user.employeeId === resourceEmployeeId` で比較しており、渡すべきは**従業員ID**。唯一の呼び出し元 `src/app/(features)/employees/[employeeCd]/actions.ts:51` も従業員レコードの id を渡している。`AuthSession` は `user.id`（認証ユーザー）と `user.employeeId` を別に持つため、この記述は「`user.id` を渡す」誤用を誘発しうる（渡すと本人判定が常に false になる潜在バグ）
- **備考**: 記述自体は本 PR 以前からの既存だが、本 PR が同一 JSDoc ブロックに `@param redirectTo` を追記しており、触る文脈にある
- **修正方針**: 「従業員ID」へ訂正する（1 語）
- **影響範囲**: 同ファイルのみ。挙動不変
- **想定テスト**: 同上

## R1-7 | ③ cleanup | severity参考: Low（差分外の 2 ファイル）

- **file:line**: `src/app/(features)/layout.tsx:14-15`, `src/shared/constants/redirect-reasons.ts:3`
- **問題**: 本 PR が proxy から認可を外した結果、**無変更ファイル**のコメントが事実と食い違うようになった
  - `layout.tsx:14`「proxy.ts は毎リクエスト走るがレンダリングのキャッシュ判定には関与しないため、**認可**は効くのに画面内容だけ古い」→ `adminRoutes` 削除後の proxy は認証しか持たないため成立しない
  - `redirect-reasons.ts:3`「proxy.tsでリダイレクト時に設定し、**flash-message-handler.tsx**で読み取る」→ `FORBIDDEN` の設定元は `verifyAdmin()` へ移り proxy が設定するのは `SESSION_EXPIRED` のみ。加えて `flash-message-handler.tsx` は実在せず、現行は `src/app/_components/redirect-reason-toast.tsx`（こちらは PR 前からの既存ズレ）
- **差分外を直す判断の理由**: 本 PR は `deviations.md` §2 で、`employees-crud.e2e.ts` の「proxy.ts の adminRoutes」という記述を「実在しない定数を指す記述を残さない」ために同一コミットで修正している。同型の齟齬をこの 2 件だけ残す整合性が無い。#636 の学び「diff に現れないファイルが静かに古くなる」の適用範囲を揃える
- **修正方針**:
  - `layout.tsx:14`「認可」→「認証」に置換。**ADR-20260727-2fb 由来の「消さないこと」段落は残し、語句のみ差し替える**
  - `redirect-reasons.ts:3` 設定元（proxy.ts と各実行境界の verifyAdmin / verifyOwnerOrAdmin）と読み取り先（`redirect-reason-toast.tsx`）を実在の名に合わせる
- **影響範囲**: 2 ファイル。いずれもコメントのみで挙動不変
- **想定テスト**: 変更なし（コメント）

---

## 実施順とコミット単位

6 件すべて `refactor:` 1 コミットにまとめる。理由: **すべてコメント／JSDoc のみでコード挙動に一切触れず、「本 PR の責務モデル変更に説明文を追随させる」という単一の意味のまとまり**を成すため。分割するとレビュー時に同じ理由の説明が 3 回繰り返される。

1. `docs:` — この計画ファイル
2. `refactor:` — R1-1〜R1-5, R1-7 のコメント／JSDoc 修正

## 対応しない指摘

- **R1-6**（④残課題）: 「一般ユーザーが submit → Server Action の `verifyAdmin()` が拒否」を検証する唯一の E2E が消えた件。計画 Step 3 が当該ケースの消失を織り込み済み（計画準拠）で、ページ側で描画前に弾かれる以上 UI 経由の維持は原理的に不可能。代替（`next-action` ヘッダ付き直接 POST 等）は設計判断を伴い③基準を満たさない。**別 Issue（Server Action 層の認可 E2E 方式の確立）として起票を推奨**
