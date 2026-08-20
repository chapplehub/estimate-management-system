# Issue #575: 見積申請詳細 承認・差戻・取下操作（FE） — 実装計画

## 概要

見積申請詳細画面（`/estimate-applications/[estimateNumber]/[variationNumber]`）に、承認・差戻・取下の操作 UI を配線する。BE コマンド（`ApproveStep` / `RejectStep` / `WithdrawApplication`）とファクトリ、参照 DTO（`operations.canApprove/canReject/canWithdraw`・`latestApplicationId`・`awaitingStepId`・`expectedVersion`・#573）は実装済みで、本 issue は FE（Server Action・ダイアログ・出し分け・成功/失敗表示・E2E）だけを担う。

- 最終防衛は BE（役割メンバー検証・本人性検証・楽観ロック）。FE の出し分けは UX のためで役割メンバーシップ判定を複製しない（DTO の 3 フラグに従う）。
- 資格の無い閲覧者には操作ボタンを一切出さず、純粋な閲覧画面として振る舞う。
- TDD（red-green-refactor）で進める。単体/コンポーネントは Vitest、動線は Playwright。

## 設計判断

会話（/grill-with-docs）で確定済み。実装中に判断を追加しない。

### Server Action の契約と成功時の画面更新
- A. #562 申請ボタンモデル: redirect せず `ActionResult<T>` 返却、成功時 `router.refresh()` で同一 URL 再導出
- B. 見積編集フォーム流: conform + redirect + `?reason=` フラッシュ
- **採用: A**。閲覧/編集のモード遷移が無い単一ビューで、成功後に欲しい「チェーン状態・バッジ・ボタン再評価」は RSC 再実行（`router.refresh()`）で自然に再導出できる。兄弟の申請ボタンと契約を揃える。ADR-0068/0069 のパターンに乗る。
- 承認は結果を区別するため `ActionResult` に判別子 `outcome: "APPROVED" | "STILL_PENDING"` を載せる。コマンドが返す `EstimateApplication.applicationStatus`（`deriveApplicationStatus`）から導出する。

### 成功提示
- sonner `toast.success(...)` を**直接**呼ぶ（`Toaster` はレイアウトで全画面マウント済み）。`?reason=` フラッシュ（redirect 連動）は使わず、新しい reason コードも増やさない。
- 文言: 差戻「差し戻しました」／取下「取り下げました」は各 1 文言。**承認は途中/最終で区別**する:
  - 途中承認（`STILL_PENDING`）: 「承認しました。次の承認ステップに進みました」
  - 最終承認（`APPROVED`）: 「承認しました。この申請は承認済になりました」
- 途中承認は refresh 後もバッジが「申請中」のままボタンだけ消えるため、文言で結果を言い切りユーザーの不安を消す。

### 失敗提示（入力保護で分岐）
- `handleCommandError` は ConflictError（楽観ロック競合）も BusinessRuleViolationError（役割非メンバー・非 PENDING 等）も区別せず `{success:false, error}` に畳む。今回はどちらも救済が「最新を読み直す」に収束するため区別不要。
- **承認・取下（入力なし）**: 失敗時はダイアログを閉じ、エラートースト＋`router.refresh()` で真実へ。
- **差戻（コメントあり）**: 失敗時は**ダイアログを開いたまま**、内部にエラー表示、入力済みコメントを温存、auto-refresh しない。
- 理由: #494 の一律「強制クローズ＋永続バナー＋no-refresh」から意図的に外れる。この画面は守るべき外部フォームが無く（閲覧専用）、守るべき貴重な入力は差戻ダイアログ内の差戻理由（必須・最大 2000 字・ADR-0058）のみ。入力保護原則をその 1 箇所にだけ適用する。
- ※この失敗ハンドリングの分岐（兄弟の申請ボタンと異なる失敗 UX にした理由）は ADR 化せず、コミットボディ／PR 説明に記載する（ユーザー判断）。

### 差戻コメントの状態保持
- コメントの `useState` は差戻ラッパー（トリガー＋Dialog を内包する常設クライアント部品）に持つ。`DialogContent` の内側に置くと Radix の unmount で消えるため、親に持たせる。
- 閉じても消さない。**クリアは差戻成功時のみ**（成功で `canReject=false` になり操作ブロックごと自然消滅）。閉じて再度開いても入力が残る。`router.refresh()` をまたいでもクライアント状態は保持される。

### 差戻コメントのバリデーション配置
- A. 素の controlled textarea ＋ 薄い UX ガード（`maxLength={2000}`・文字数カウンタ・trim 後空で送信無効）。権威は VO `RejectionComment`（必須・1〜2000 字・trim）。すり抜けは `handleCommandError` 経由で表面化
- B. conform + zod スキーマ
- **採用: A**。VO が権威なので FE はミラーせず（ADR-0069）UX 補助に留める。`ApplicationConfirmDialog`（#562）の素 `useState` 前例に一致し、コメント状態保持も素直に成立する。

### Server Action のシグネチャ
- 承認/取下は estimateNumber からの estimateId 再解決が不要（対象は `stepId`／`applicationId` の identity で、BE が membership・本人性・version を再検証する）。
- `approveStep(stepId, expectedVersion)` / `rejectStep(stepId, comment, expectedVersion)` / `withdrawApplication(applicationId, expectedVersion)`。operator は各 Action 内で `verifySession()` から解決（null は fail-fast）。

### revalidate の単位
- Server Action で `revalidatePath` は呼ばない。redirect しないので現ビューは `router.refresh()` で再導出、一覧・見積詳細は別ナビゲーションで dynamic 再クエリされる（#562 と同一方針）。

### CONTEXT.md / ADR
- CONTEXT.md 変更なし（今回の決定は FE/UX/実装判断で、新ドメイン用語の導入・鋭利化なし。途中承認/最終承認は既存概念の状況記述）。
- ADR 起票なし（失敗ハンドリング分岐は可逆性が中程度のためコミット/PR 記載に留める・ユーザー判断）。

### E2E のテストデータ
- 既存表示フィクスチャ（N9905011〜15・申請者 EMP000003・承認待ち役割 営業課長/営業部長）は operator 中立に作られており、ログインユーザー（employee1=社長/employee2=営業本部長）が承認資格も本人でもないため操作成功動線に使えない。
- **採用: 動線別の独立新フィクスチャ**を `seed-estimate-applications.ts` に追加し、主役 employee2（営業本部長）に紐づける。社長は常に頂点で途中承認を作れないため、中間役割の営業本部長を主役に、その上に社長ステップを置いて途中承認を成立させる。

## ステップ

### Step 1: 承認・差戻・取下の Server Action（契約テスト先行）
- 対象ファイル:
  - `src/app/(features)/estimate-applications/[estimateNumber]/[variationNumber]/actions.ts`（新規）
  - 同ディレクトリ `actions.test.ts`（新規・契約テスト）
- 作業内容:
  - red: コマンドファクトリをモックし、契約を固定するテストを書く。
    - operator を `verifySession()` から解決し各コマンドへ渡す（null は失敗）
    - `expectedVersion` を client エコーのまま渡す（サーバで読み直さない・ADR-0068）
    - `approveStep` は返却 `EstimateApplication.applicationStatus` が APPROVED なら `outcome:"APPROVED"`、それ以外は `"STILL_PENDING"` を `ActionResult` に載せる
    - ConflictError / BusinessRuleViolationError を `handleCommandError` 経由で `{success:false, error}` に変換
  - green: `"use server"` の 3 Action を実装。`approveStepCommandFactory` / `rejectStepCommandFactory` / `withdrawApplicationCommandFactory` を配線。差戻は comment を生文字列で渡す（VO は BE で構築）。redirect しない。
- コミットメッセージ: `feat: 見積申請詳細 承認・差戻・取下のServer Action（FE）`
  - ボディに「失敗ハンドリングを入力保護で分岐（承認/取下=refresh、差戻=ダイアログ保持）した理由。#494 の一律 force-close から外れる根拠＝閲覧専用画面で守るべき入力は差戻理由のみ」を記載。

### Step 2: 操作ダイアログ（承認/取下 確認・差戻 コメント入力）＋コンポーネントテスト
- 対象ファイル:
  - 同ディレクトリ `_components/ApplicationOperations.tsx`（新規・常設クライアント部品。3 ダイアログと差戻コメント state を内包）
  - `_components/ApplicationOperations.test.tsx`（新規）
- 作業内容:
  - red: コンポーネントテスト（Vitest + testing-library）。
    - 承認/取下は確認ダイアログ（確定/キャンセル）
    - 差戻は textarea・trim 後空で送信無効・`maxLength`・文字数カウンタ
    - **差戻コメントを閉じて再度開いても保持**、成功時のみクリア
    - 成功時 `toast.success` 呼び出し（承認は outcome で文言分岐）＋`router.refresh()`
    - 失敗時: 承認/取下は閉じてエラートースト、差戻はダイアログ保持＋内部エラー＋コメント温存
  - green: `ApplicationOperations` を実装。`operations`（3 フラグ・`latestApplicationId`・`awaitingStepId`・`expectedVersion`）と要約（確認文用の variationNumber）を props で受け、`canApprove/canReject/canWithdraw` でボタン出し分け。sonner を直接呼ぶ。
- コミットメッセージ: `feat: 見積申請詳細 承認・差戻・取下の操作ダイアログ（FE）`

### Step 3: 詳細ページへの操作ブロック配線
- 対象ファイル:
  - `src/app/(features)/estimate-applications/[estimateNumber]/[variationNumber]/page.tsx`
- 作業内容:
  - 要約ヘッダの後に `ApplicationOperations` を描画し、`detail.operations` と要約を渡す（現状 page は operations を描画していない）。
  - 資格なし（3 フラグ全 false）ではボタンが出ないことを配線上担保。
- コミットメッセージ: `feat: 見積申請詳細画面に操作ブロックを配線（FE）`

### Step 4: E2E フィクスチャ追加＋操作動線 E2E
- 対象ファイル:
  - `prisma/seed-estimate-applications.ts`（動線別独立フィクスチャ 4 本を追加・N9905016〜・主役 EMP000002）
  - `src/app/(features)/estimate-applications/[estimateNumber]/[variationNumber]/estimate-application-detail-operations.e2e.ts`（新規・storageState=user.json）
- 作業内容:
  - フィクスチャ:
    1. 最終承認用: 単段・承認待ち=営業本部長
    2. 途中承認用: 2 段（step1=営業本部長／step2=社長）
    3. 差戻用: 承認待ち=営業本部長
    4. 取下用: 申請者=EMP000002
  - E2E（employee2 ログイン）:
    - 承認して承認済になる（バッジ「承認済」＋成功トースト＋操作消滅）
    - 途中承認（バッジ「申請中」のまま・自ステップ承認済・承認ボタン消滅＋「次の承認ステップに進みました」）
    - 差戻（コメント入力→バッジ「差戻」＋差戻コメント表示＋成功トースト）
    - 取下（バッジ「取下」＋取下記録＋成功トースト）
    - 負: 既存 N9905015 を employee2 で開き操作ボタンが一切出ない（純粋閲覧）
  - 競合/ガード拒否は E2E に載せない（フレーキー回避・単体に委譲）。
- コミットメッセージ:
  - `test: 見積申請詳細 操作動線のE2Eフィクスチャを追加`
  - `test: 見積申請詳細 承認・差戻・取下の操作動線E2E`
