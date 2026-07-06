# Issue #494: 見積申請 FE（申請ボタン・確認モーダル・Server Actions） — 実装計画

## 概要

見積詳細画面（S2）にバリエーション申請 UI を実装する。申請ボタン → 確認モーダル（プレビュー）→ 実行のフロー（仕様書 §6）を、#491 で合意した BE 契約（ADR-0069）を直 type-import で消費して配線する。あわせて、モーダルが消費する当事者として `PreviewApplicationResultDTO` の小さな是正（BLOCKED/INACTIVE の label 同梱）を本 issue で行う。

grill-with-docs セッションでコード・ADR と突き合わせた結果、Issue 本文から複数の是正（主に `EstimateApplicationPersistError` の撤去済み事実の反映、ボタン無効化ゲートの単一化）が確定した。詳細は「設計判断」に記載し、完了時に `deviations.md` へ記録する。

CONTEXT.md は新規用語が生じないため変更しない（「見積申請」は既に「申請」の _Avoid_ に収録済み。申請対象はバリエーションであり、新設物はバリエーション申請の語彙で統一する）。新規 ADR も起票しない（リカバリ方針は局所的な FE UX で、コンポーネントの doc コメント＋PR に記録する）。

## 設計判断

### `EstimateApplicationPersistError` の扱い
- A. Issue 本文どおりエラー経路として処理する
- B. スコープから除外する
- **確定: B**。ADR-20260626-dee の bump+insert 原子化により「bump 成功・insert 失敗」が発生し得なくなり、本例外は撤去済み（コードベースに存在しない）。submit のエラーは `ConflictError` と正常 union の 2 分岐のみ。存在しない型へのハンドラはデッドコード＋コンパイルエラーになる。Issue 本文は #440 撤去以前の記述に引きずられた陳腐化。

### 申請ボタンの無効化ゲート
- A. Issue 本文どおり `isVariationApplicable`（`status === "ACTIVE"` を要求）を新設し、`canApply=false` と併用
- B. `canApply` 単一ゲート。`isVariationApplicable` は新設しない
- **確定: B**。`VariationApplicationStateDTO.canApply` は既に「ACTIVE かつ 見積内に前進バリなし」と定義され INACTIVE は false。`isVariationApplicable`（ACTIVE のみ）は canApply の部分再導出にすぎず、無効化式 `!isVariationApplicable || !canApply` は `!canApply` に潰れる。ADR-0069 が禁じる「FE による BE 状態語彙の再発明（ドリフト源）」に該当。tooltip 文言の出し分けは手元の `variation.status` で足りる（INACTIVE →「無効なバリエーションは申請できません」／ACTIVE かつ !canApply →「既に前進しているバリエーションがあります」）。

### BLOCKED ラベルの単一ソース
- A. Issue 本文どおり `blockedMessage` を application-shared へ引き上げ
- B. code 定義に隣接した `BLOCKED_REASON_LABELS` map をドメインに co-locate
- **確定: B**。EXEMPT の label 源 `EstimateExemptionReason` は VO に code＋label を同梱（ADR-0069 原則#2）。BLOCKED も対称にすべき。`ApprovalChainBlockedReason` は非永続の判別子なので full-VO は過剰、`Record<ApprovalChainBlockedReason, string>` の軽量 map を `ApprovalChainBuilder` 隣に co-locate。`PreviewApplicationQuery`（reasonLabel）と `SubmitApplicationCommand`（error message）が同一ソースから引く。ユーザー向け label からは内部参照「（§5.2）」を落とす。

### INACTIVE の自己記述
- A. DTO に BE 供給の `label` を追加
- B. FE 固定定数で描画（DTO は `{kind:"INACTIVE"}` のまま）
- **確定: A**。モーダルの実行不可分岐（BLOCKED.reasonLabel / INACTIVE.label）の表示文言を全て BE 所有に統一。INACTIVE は code 集合を持たない単一 kind なので `reason` は持たず `label` 単体（VO/map 不要、`PreviewApplicationQuery` が固定のレース自覚文言を載せる）。

### preview 消費のコンパイル時型証明
- A. Issue 本文どおり独立した消費スタブファイルを新設
- B. 実モーダルの `kind` 網羅 switch（never ガード付き default）に内蔵
- **確定: B**。独立スタブは実描画とドリフトしうる（スタブだけ緑でも実モーダルが網羅漏れ）。本 issue は実モーダルを実装するので、その描画 switch 自体を証明にすれば drift 余地ゼロ。DTO に kind が増減すれば実モーダルが即コンパイルエラー、pre-push の `tsc --noEmit` が gate。

### submit 失敗リカバリ
- A. モーダル内で再プレビュー＋再確認
- B. モーダル強制クローズ＋パネル上部の永続バナー（auto-refresh しない）
- **確定: B**。理由（1）preview は兄弟前進を見ない（4 分岐に「兄弟前進で申請不可」が無い）ため、素の再プレビューは誤って再確認ボタンを出しループ・誤誘導する。（2）ユーザーがメモ等を編集中／文言をコピーしたい可能性があるため、`router.refresh()` で画面状態を勝手に奪わない。よって ConflictError / BusinessRuleViolationError 共通で、モーダルを強制クローズしパネル上部へ永続バナー（`handleCommandError` の message ＋「内容を確認・必要な情報を控えてから F5 か一覧へ戻って更新」）を出し、更新タイミングはユーザーに委ねる。auto-refresh は呼ばない。バナー表示中も申請ボタンは押下可のまま（無駄な再試行はバナーで自明、強制はしない）。トレードオフ: パネルの canApply・バッジ・金額は古いまま表示され続けるため、バナーで「最新ではない」と明示警告する。

### operator（session.user.employeeId）が null の場合
- 既存「null は複製不可」前例踏襲のため判断不要。preview / submit 両アクションに null ガードを置きメッセージを返す（「申請者の従業員情報が取得できないため申請できません。管理者にお問い合わせください。」）。前段のボタン抑止はしない。preview の null エラーはモーダル内メッセージ＋閉じる（状態変化ではない前提条件エラーなのでバナー導線に乗せない）。

### Server Actions のマッピング
- 既存パターン踏襲のため判断不要。operator は `session.user.employeeId` から注入、`estimateId` は `estimateNumber` から `getEstimateDetailQueryFactory` で再解決、`variationId`(UUID) は client エコー、`version` は submit のみ client エコー・サーバで読み直さない（TOCTOU・ADR-0068）。

### §6.2 仕様書の是正範囲
- **確定**: BLOCKED を実装の 3 値（`NO_SUPERIOR_ROLE`/`GOAL_UNREACHABLE`/`NO_APPROVER`）に更新＋欠落している INACTIVE 分岐を追加＋ EXEMPT/BLOCKED/INACTIVE が BE 供給 label を持つことを明記。submit 失敗リカバリの UX は FE 実装詳細のため仕様書には含めない。

## ステップ

### Step 1: BLOCKED ラベルのドメイン単一ソース化
- 対象ファイル: `src/server/subdomains/estimate/domain/services/approval/ApprovalChainBuilder.ts`（or 隣接ファイル）、`src/server/subdomains/estimate/application/commands/SubmitApplicationCommand.ts`
- 作業内容:
  - `ApprovalChainBlockedReason` の隣に `BLOCKED_REASON_LABELS: Record<ApprovalChainBlockedReason, string>` を co-locate（ユーザー向け文言・「（§5.2）」は含めない）
  - `SubmitApplicationCommand` の private `blockedMessage` を撤去し、error message を map から引く
- コミットメッセージ: `refactor: BLOCKED理由ラベルをドメインのBLOCKED_REASON_LABELSへ単一ソース化`

### Step 2: PreviewApplicationResultDTO の是正（BLOCKED.reasonLabel / INACTIVE.label）
- 対象ファイル: `src/server/subdomains/estimate/application/queries/dto/PreviewApplicationResultDTO.ts`、`src/server/subdomains/estimate/application/queries/PreviewApplicationQuery.ts`、（既存テスト）`.../queries/__tests__/PreviewApplicationQuery.test.ts`
- 作業内容:
  - DTO の BLOCKED に `reasonLabel`、INACTIVE に `label` を追加
  - `PreviewApplicationQuery` が BLOCKED 時に `BLOCKED_REASON_LABELS` から reasonLabel を、INACTIVE 時に固定のレース自覚 label を populate
  - Query テストを新フィールドに追随
- コミットメッセージ: `feat: 申請プレビューDTOのBLOCKED/INACTIVE分岐を自己記述化（reasonLabel/label同梱）`

### Step 3: Server Actions（previewApplication / submitApplication）
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/actions.ts`、（必要なら）対応スキーマ
- 作業内容:
  - operator を session 注入（null ガード＋メッセージ）、`estimateId` を estimateNumber から再解決、`variationId` client エコー、`version` は submit のみ client エコー
  - preview は `PreviewApplicationResultDTO` を返す（or ActionResult ラップ）、submit は `handleCommandError` で ConflictError/BusinessRuleViolationError を message 化
- コミットメッセージ: `feat: 申請プレビュー・申請実行のServer Actionsを追加`

### Step 4: action マッピング契約テスト
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/__tests__/`（既存前例に倣う）
- 作業内容:
  - operator がセッション注入され client 入力を無視する / `estimateId` が estimateNumber から再解決される / `version` が client エコーされサーバで読み直されない、を固定
- コミットメッセージ: `test: 申請Server Actionのマッピング契約テストを追加`

### Step 5: 確認モーダルコンポーネント
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/`（新規モーダルコンポーネント）
- 作業内容:
  - open 時に previewApplication を呼び、`kind` を網羅 switch（never ガード）で描画（EXEMPT/REQUIRED/BLOCKED/INACTIVE）＝コンパイル時消費証明を内蔵
  - REQUIRED はチェーン全体（課長→部長(最終)）＋金額（`VariationDTO.finalTotal`）を表示し確認ボタン、BLOCKED/INACTIVE は文言のみで確認を出さない、EXEMPT は理由 label ＋確認
  - submit 成功は既存流儀で閉じてパネル更新、失敗（ConflictError/BusinessRuleViolationError）は VariationPanel へコールバックして強制クローズ
  - operator null の preview エラーはモーダル内メッセージ＋閉じる
- コミットメッセージ: `feat: 見積申請の確認モーダル（プレビュー分岐描画）を追加`

### Step 6: VariationPanel への申請ボタン・バッジ・失敗バナー配線
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/VariationPanel.tsx`、`page.tsx`、`variationApplicationStateBadge.ts` 周辺、`variationEditable.ts`（必要な範囲）
- 作業内容:
  - `page.tsx` で `GetVariationApplicationStates` を取得し `VariationPanel` へ渡す（variationId で `VariationDTO` と join）
  - 申請ボタンを常に表示、無効化は `canApply` 単一ゲート、tooltip は `variation.status` で文言選択（`isVariationApplicable` は新設しない）
  - バリエーション別バッジに `applicationState.label` を表示（既存 stub を土台に肉付け）
  - submit 失敗時の永続バナー state を VariationPanel に lift（パネル上部・`role="alert"`・auto-refresh なし・申請ボタンは押下可）
- コミットメッセージ: `feat: 見積詳細に申請ボタン・申請状態バッジ・競合バナーを配線`

### Step 7: 仕様書 §6.2 の是正
- 対象ファイル: `docs/business/estimate/システム設計書(申請).md`
- 作業内容:
  - BLOCKED を 3 値に更新、INACTIVE 分岐を追加、EXEMPT/BLOCKED/INACTIVE が BE 供給 label を持つことを明記
- コミットメッセージ: `docs: 申請設計書§6.2をpreview契約の実態（3値BLOCKED・INACTIVE・label）に追随`

### Step 8: E2E ＋ 逸脱記録
- 対象ファイル: 見積詳細の E2E spec、`docs/claude-plans/issue-494/deviations.md`
- 作業内容:
  - 申請→preview→確認→submit を実 DB（seed）で承認必要・承認免除の両経路、INACTIVE のボタン前段無効化＋tooltip を検証
  - deviations.md に本計画の逸脱（PersistError 除外／isVariationApplicable 不新設／BLOCKED ラベルのドメイン配置／preview 証明の実モーダル内蔵／リカバリのバナー方式）を記録
- コミットメッセージ: `test: 見積申請フローのE2Eテストを追加`
