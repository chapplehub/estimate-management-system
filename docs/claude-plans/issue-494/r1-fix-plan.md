# Issue #494 PR562 自動レビュー＆修正 ラウンド1 修正計画

`/code-review medium` → judge 評価で採用された指摘の修正方針。採用①②=3件（全て①）、採用③=3件。

## ① correctness bug

### 指摘3（採用・High）getEstimateDetail が try/catch 外で reject 握り潰し
- file:line: `actions.ts:396,437`（previewApplication / submitApplication）
- 問題: `getEstimateDetailQueryFactory().execute()` が try の外。インフラ例外時に ActionResult を返さず reject。モーダル側（`ApplicationConfirmDialog` handleOpen/handleSubmit）は try/catch なしで await するため、preview は「取得しています…」固着、submit は失敗バナー導線もクローズも発火せず握り潰し。
- 修正方針: **指摘7（③）と統合**。共通プロローグを private 関数 `resolveApplicationContext(estimateNumber)` に抽出し、その中で `getEstimateDetail` を try/catch で囲み `handleCommandError` で ActionResult 化する。preview/submit は `const ctx = await resolveApplicationContext(...); if (!ctx.success) return ctx;` で使う。
- 影響範囲: `actions.ts` のみ（レイヤまたぎなし）。
- 想定テスト: 既存 `applicationActions.test.ts` が緑のまま。getEstimateDetail reject 時に `{success:false}` を返すことを追加検証しうる（既存テスト構造に合わせる）。

### 指摘1（採用・Low）網羅 switch default がオブジェクトを return しクラッシュ
- file:line: `ApplicationConfirmDialog.tsx:231-235`
- 問題: default が `return _exhaustive`（=preview オブジェクト自体）。実行時の版スキューで未知 kind 受信時に React が「Objects are not valid as a React child」で描画クラッシュ。
- 修正方針: `const _exhaustive: never = preview;`（コンパイル時網羅証明・逸脱④の意図）は残し、`return _exhaustive;` を `return null;` に変更。実行時は何も描かない（安全側）。コメントを実行時挙動込みで更新。
- 影響範囲: 当該ファイルのみ。
- 想定テスト: 既存 `ApplicationConfirmDialog.test.tsx` 緑のまま。

### 指摘4（採用・Low）申請成功時に applyFailure バナー未クリア
- file:line: `VariationPanel.tsx:97,291` + `ApplicationConfirmDialog.tsx:96-98`
- 問題: submit 成功は `setOpen(false)+router.refresh()` のみで applyFailure（client useState）を消さない。「失敗→再申請成功」後もバナー『最新ではない』が残る誤表示。
- 修正方針: `onSubmitFailure` と対称に optional な `onSubmitSuccess?: () => void` を Props に追加。ダイアログ success 分岐で `onSubmitSuccess?.()` を `router.refresh()` 前に呼ぶ。`VariationPanel` で `onSubmitSuccess={() => setApplyFailure(null)}` を渡す。
- 影響範囲: 2 ファイル（同一 feature、公開シグネチャは optional 追加で後方互換）。
- 想定テスト: `ApplicationConfirmDialog.test.tsx` に「成功時 onSubmitSuccess が呼ばれる」を追加しうる。

## ③ cleanup

### 指摘7（採用・③／指摘3と統合）共通プロローグ二重化 → private 関数抽出
- 上記指摘3の修正で `resolveApplicationContext` を private 抽出することで同時解消。
- ③採用根拠: 挙動不変（verifySession→operator ガード→estimateId 解決の順・文言同一）、同一ファイル内 private 関数抽出（③規約で明示可）、公開シグネチャ不変、局所。

### 指摘6（採用・③）catch 内 errorMessage 計算がデッドコード
- file:line: `actions.ts:409-411,451-453`
- 修正方針: `const errorResult = ...; const errorMessage = ...; return {success:false, error:errorMessage}` を `return handleCommandError(error)` に置換。
- ③採用根拠: handleCommandError は全分岐で `{success:false, error:非空}` を返すため恒等・挙動不変（console.error 副作用も内包保持）、同一ファイル2箇所の局所置換、公開シグネチャ不変。

### 指摘8（採用・③）全件 Map 索引を active 1キーしか読まない
- file:line: `VariationPanel.tsx:100-103,107`
- 修正方針: `useMemo`+`new Map(...)` を削除し、`activeApplicationState` を `applicationStates.find((s) => s.variationId === active.variationId)` で直接引く。
- ③採用根拠: 未発見時 undefined も同値で挙動不変、単一ファイル数行、公開シグネチャ不変、設計判断不要。

## 計画からの逸脱（記録予定）
- CLAUDE.md 系の「①②を先に、③を最後に」原則に対し、指摘3(①)と指摘7(③)は**完全に同一の8行**を対象とするため分割せず1コミットに統合する。分割はむしろ二度手間＋競合事故を招くため。→ deviations.md に追記。

## コミット分割
1. `fix:` 指摘3+7 統合（resolveApplicationContext 抽出＋getEstimateDetail を try 内へ）
2. `fix:` 指摘4（onSubmitSuccess でバナークリア）
3. `fix:` 指摘1（switch default を null 化）
4. `refactor:` 指摘6（catch デッドコード除去）
5. `refactor:` 指摘8（useMemo Map → find）
- 計画ファイル自体は `docs:`。
