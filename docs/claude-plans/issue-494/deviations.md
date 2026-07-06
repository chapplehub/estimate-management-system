# Issue #494 実装の逸脱記録

計画（`estimate-application-fe-modal-and-actions.md`）および Issue #494 本文と、実際の実装との差分を記録する。
大半は grill-with-docs でコード・ADR と突き合わせた結果、Issue 本文の陳腐化を是正したものであり、
計画時点で合意済み。実装フェーズで計画からさらに逸脱した点は末尾に別記する。

## Issue 本文 → 計画で確定した是正

### ① `EstimateApplicationPersistError` の扱い（スコープ除外）
- **元の計画（Issue 本文）**: submit のエラー経路として `EstimateApplicationPersistError` をハンドルする。
- **実際の実装**: ハンドルしない（型自体が存在しない）。submit のエラーは `ConflictError` と正常 union の 2 分岐のみ。
- **逸脱の理由**: ADR-20260626-dee の bump+insert 原子化により「bump 成功・insert 失敗」が発生し得なくなり、
  本例外は #440 で撤去済み。Issue 本文は撤去以前の ADR-0068 記述に引きずられていた。存在しない型への
  ハンドラはデッドコード＋コンパイルエラーになる。

### ② 申請ボタンの無効化ゲート（`isVariationApplicable` 不新設）
- **元の計画（Issue 本文）**: `isVariationApplicable`（`status === "ACTIVE"` を要求）を新設し `canApply=false` と併用。
- **実際の実装**: `canApply` 単一ゲート。`isVariationApplicable` は新設しない。無効時のツールチップ文言だけ
  手元の `variation.status` で選ぶ。
- **逸脱の理由**: `VariationApplicationStateDTO.canApply` は既に「ACTIVE かつ 見積内に前進バリなし」と定義され
  INACTIVE は false。`isVariationApplicable`（ACTIVE のみ）は canApply の部分再導出にすぎず、無効化式
  `!isVariationApplicable || !canApply` は `!canApply` に潰れる。ADR-0069 が禁じる「FE による BE 状態語彙の
  再発明（ドリフト源）」に該当。

### ③ BLOCKED ラベルの単一ソース（ドメイン co-locate）
- **元の計画（Issue 本文）**: `blockedMessage` を application-shared へ引き上げる。
- **実際の実装**: `ApprovalChainBlockedReason` の隣（ドメイン層 `ApprovalChainBuilder.ts`）に
  `BLOCKED_REASON_LABELS: Record<ApprovalChainBlockedReason, string>` を co-locate。
- **逸脱の理由**: EXEMPT の label 源 `EstimateExemptionReason`（VO に code＋label 同梱）と対称にすべき
  （ADR-0069 原則#2）。`ApprovalChainBlockedReason` は非永続の判別子ゆえ full-VO は過剰で `Record` の軽量 map。
  Preview（reasonLabel）と Submit（業務例外 message）が同一ソースから引く。ユーザー向け文言から内部参照
  「（§5.2）」を落とした。

### ④ preview 消費のコンパイル時型証明（実モーダル内蔵）
- **元の計画（Issue 本文）**: 独立した消費スタブファイルを新設する。
- **実際の実装**: 実モーダル（`ApplicationConfirmDialog`）の `kind` 網羅 switch（never ガード付き default）に内蔵。
- **逸脱の理由**: 独立スタブは実描画とドリフトしうる（スタブだけ緑でも実モーダルが網羅漏れ）。本 issue は実モーダルを
  実装するので、その描画 switch 自体を証明にすれば drift 余地ゼロ。DTO に kind が増減すれば実モーダルが即コンパイル
  エラーになり pre-push の `tsc --noEmit` が gate。

### ⑤ submit 失敗リカバリ（バナー方式・auto-refresh しない）
- **元の計画（Issue 本文）**: モーダル内で再プレビュー＋再確認、または `router.refresh()` で自動更新。
- **実際の実装**: モーダル強制クローズ＋パネル上部の永続バナー（`role="alert"`）。`router.refresh()` は呼ばず、
  更新タイミングはユーザーに委ねる。ConflictError / BusinessRuleViolationError 共通。
- **逸脱の理由**: (1) preview は兄弟前進を見ない（4 分岐に「兄弟前進で申請不可」が無い）ため、素の再プレビューは
  誤って再確認ボタンを出しループ・誤誘導する。(2) ユーザーがメモ等を編集中／文言をコピーしたい可能性があるため、
  `router.refresh()` で画面状態を勝手に奪わない。パネルの canApply・バッジ・金額は古いままのため、バナーで
  「最新ではない」と明示警告する。

## 実装フェーズでの計画からの追加逸脱

### ⑥ 確認モーダルコンポーネント名を `ApplicationConfirmDialog` に確定
- **元の計画**: 「新規モーダルコンポーネント」（名称未定）。
- **実際の実装**: `ApplicationConfirmDialog.tsx`。
- **逸脱の理由**: 既存の自己完結ダイアログ命名（`ReviseForCustomerDialog`）に倣い、「確認モーダル」の役割を名に表した。

### ⑦ バッジ色調ヘルパー `badgeToneClassName` を追加
- **元の計画**: バッジは既存 stub（`variationApplicationStateBadge.ts`）を土台に肉付け。
- **実際の実装**: 同ファイルに `badgeToneClassName`（tone → Tailwind クラス）を追加し、shadcn Badge に無い
  success/warning/info 相当の配色を補った。
- **逸脱の理由**: shadcn Badge の variant は default/secondary/destructive/outline のみで、申請状態の 4 tone を
  表現できない。tone→className の写像を既存バッジ消費ファイルに co-locate した（網羅 switch＋never ガード）。
