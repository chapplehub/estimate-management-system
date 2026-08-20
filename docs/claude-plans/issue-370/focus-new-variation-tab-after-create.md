# Issue #370: 複製/＋バリエーション追加後に新規バリエーションのタブを選択状態にする — 実装計画

## 概要

見積編集画面で「複製」「＋バリエーション追加」を押して保存しても、保存前に選択していた
バリエーションのタブが選択され続け、新規作成したバリエーションのタブに切り替わらない。
新規作成したバリエーションのタブを自動で選択状態にする。

### 原因（実機検証で確定）

- 保存時の Server Action は `revalidatePath` の後に `redirect` する。これにより
  `VariationPanel`（client island）が**再マウント**され、`useState` の初期値
  `firstActive`（最小番号の ACTIVE バリ）で `activeIndex` が再初期化される。
- 結果、毎回「先頭 ACTIVE バリ（=バリエーション1）」に戻り、末尾に追加された新バリは
  タブとして出現するが選択されない。
- 実機確認: `N9905003` で ＋バリエーション追加 → 保存後、フォームは閉じる（mode=view に
  戻る）が、選択タブは「バリエーション1」のまま・新「バリエーション2」は未選択。
  コンソール Errors/Warnings = 0（純粋な state 設計の問題）。
- 複製ボタンも同じ `addVariation` 経由のため、本修正で同時に解消する。

## 設計判断

### 新規バリエーションを「選択すべきタブ」として特定する方法
- A. 最大番号の不変条件を利用 ← **採用**
- B. `addVariation` の戻り値 `TaxCheckedSaveResult.saved.estimate` から新バリ番号を取り出し URL に載せる
- 採用理由: `addVariation` は集約が `max+1` で末尾に自動採番する（§A.2）ため、追加・複製後の
  新バリは**常に最大 variationNumber**。番号を URL に載せる必要がなく、「追加直後か否か」の
  フラグだけで末尾タブを選べる。実装がシンプル。

### 「追加直後か否か」のフラグの伝え方（＝フラッシュメッセージ）
- 専用 redirect reason `estimate_variation_added` を新設 ← **採用**
- 採用理由: 既存の `estimate_updated`（「見積を更新しました」）と分離し、UI 上も「バリエーションを
  追加しました」と明示する。この専用 reason 自体が「追加直後＝末尾タブを選べ」のシグナルを兼ねる
  ため、選択制御用の追加パラメータが不要。

### タブ初期選択ロジックの配置・実装方式
- `useState` の初期値で制御する（`useEffect` での後追い setState は採らない）
- 理由: 実機検証で redirect 時に `VariationPanel` が再マウント・`useState` 再初期化される
  ことを確認済み。初期値で決めれば一瞬古いタブが見えるちらつきが出ない。
- 初期 index の決定を**純関数に切り出し**、ユニットテスト可能にする（TDD）。

### reason 削除の `router.replace` との競合（実装時の検証ポイント・未確定リスク）
- `redirect-reason-toast.tsx` は reason を読んでトースト表示後、`router.replace` で URL から
  reason を削除する。この 2 段目のナビゲーションで `VariationPanel` が再マウントされ、
  reason が消えた状態で再初期化されると末尾選択が解除され「バリエーション1」に戻る恐れがある。
- 想定: 1 段目 redirect は `revalidatePath` 付き → 再マウント＆末尾選択。2 段目 replace は
  `revalidatePath` 無し → Client Component の state 保持（再マウントされない）→ 選択維持。
- この想定が成立するかは **Step 5 の実機検証で必ず確認する**。崩れる場合は VariationPanel 側で
  「初回の末尾選択を以後の再マウントでも維持する」仕組みを追加検討する（実装時に判断）。

### スコープ外
- 得意先改訂（`reviseForCustomer` / `estimate_revised`）も類似構造だが本 issue の対象外。
  ADR 起票や横展開は別途ユーザー判断。

## ステップ

### Step 1: タブ初期 index 決定を純関数に切り出す（TDD: RED→GREEN→REFACTOR）
- 対象ファイル:
  - 新規: `src/app/(features)/estimates/[estimateNumber]/resolveInitialActiveIndex.ts`
  - 新規: 同 `__tests__`（または併設）のユニットテスト
  - `src/app/(features)/estimates/[estimateNumber]/VariationPanel.tsx`（初期化式を関数呼び出しへ置換）
- 作業内容:
  - 先にテストを書く（RED）:
    - `focusLast: false`（既定）→ 最小番号 ACTIVE バリの index。全 INACTIVE なら 0。
    - `focusLast: true` → 最大 variationNumber（＝末尾）の index。
    - variations が昇順前提・空配列ガードのケース。
  - `resolveInitialActiveIndex(variations, { focusLast })` を実装（GREEN）。
  - `VariationPanel` の `useState(firstActive >= 0 ? firstActive : 0)` を
    `useState(() => resolveInitialActiveIndex(variations, { focusLast: focusLastVariation }))` へ。
    この時点では `focusLastVariation` は未配線（既定 false で既存挙動維持）。
- コミットメッセージ: `fix: バリエーションタブの初期選択ロジックを純関数化しユニットテストを追加 (#370)`

### Step 2: 専用 redirect reason `estimate_variation_added` を新設
- 対象ファイル:
  - `src/shared/constants/redirect-reasons.ts`（`ESTIMATE_VARIATION_ADDED: "estimate_variation_added"` 追加）
  - `src/app/_components/redirect-reason-toast.tsx`（`FLASH_MESSAGES` に「バリエーションを追加しました。」追加）
- 作業内容:
  - 定数追加（型 `RedirectReason` / `isRedirectReason` は自動で追従）。
  - `FLASH_MESSAGES` は全 reason 網羅の `Record` のため、追加しないと型エラー。SUCCESS で文言追加。
- コミットメッセージ: `feat: バリエーション追加用のフラッシュreason(estimate_variation_added)を追加 (#370)`

### Step 3: addVariation のリダイレクト先を専用 reason に変更
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/actions.ts`（`addVariation` の redirect）
- 作業内容:
  - 成功時の `redirect(...?reason=ESTIMATE_UPDATED)` を `ESTIMATE_VARIATION_ADDED` へ変更。
- コミットメッセージ: `fix: バリエーション追加成功時のリダイレクトを専用reasonに変更 (#370)`

### Step 4: page.tsx で reason を読み VariationPanel へ focusLast を配線（中核修正）
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/page.tsx`（`searchParams` 受け取り・reason 判定）
  - `src/app/(features)/estimates/[estimateNumber]/VariationPanel.tsx`（props に `focusLastVariation?: boolean` 追加）
- 作業内容:
  - `page.tsx` の引数に `searchParams: Promise<{ reason?: string }>` を追加し await 解決。
  - `reason === REDIRECT_REASON.ESTIMATE_VARIATION_ADDED` を `focusLastVariation` として `VariationPanel` へ渡す。
  - `VariationPanel` は受け取った `focusLastVariation` を Step 1 の初期化に反映。
- コミットメッセージ: `fix: バリエーション追加/複製後に新規タブを選択状態にする (#370)`

### Step 5: E2E 更新 ＋ 実機検証（reason 削除 replace 競合の確認）
- 対象ファイル:
  - `src/app/(features)/estimates/estimates-variation-create.e2e.ts`
- 作業内容:
  - 新規追加/複製の保存後、新タブが `selected`（`aria-selected=true`）であることを検証する
    アサーションへ更新（現状の「表示確認のための手動 `tab.click()`」を自動選択検証に置換）。
  - フラッシュ文言が「バリエーションを追加しました。」になる点を反映。
  - `verify-frontend` で実機確認: 保存 → 末尾タブが選択される / トースト表示後に reason が
    URL から消えても選択が維持される（設計判断の競合リスク検証）。
- コミットメッセージ: `test: バリエーション追加/複製後の新規タブ自動選択をE2Eで検証 (#370)`
