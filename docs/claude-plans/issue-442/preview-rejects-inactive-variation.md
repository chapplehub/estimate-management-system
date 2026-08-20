# Issue #442: 申請プレビューが INACTIVE バリエーションを弾かず Submit と可否が食い違う — 実装計画

## Context

PR #437（#417）レビュー指摘 #4。`loadApprovalChainInputs` は越境ローダーとして
`targetVariationIsActive` という「バリエーションが有効か」の事実を集めているが、これを
「申請可否」へ変換しているのは `SubmitApplicationCommand` だけ。`PreviewApplicationQuery` は
同じローダーを使いながらこの事実を読まず、judge＋チェーン組立てをそのまま走らせている。

結果、確認モーダル（Preview）は INACTIVE バリエーションでも EXEMPT/REQUIRED を返し
「申請できる」かのように承認チェーンを見せるが、実行（Submit）で初めて
「無効なバリエーションには申請できません」で弾かれる。Preview/Submit が同一事実から異なる
可否を答えており、共有ローダーの目的（ドリフト防止）に対し最も基本的な可否要因が
消費から漏れている。本修正はこの漏れを Preview 側で閉じ、両者の可否を一致させる。

## 設計判断

### INACTIVE の DTO 表現 — 専用 kind を追加（ユーザー確認済み）
- A. `PreviewApplicationResultDTO` に専用 `{ kind: "INACTIVE" }` を新設 ← **採用**
- B. `BLOCKED.reason` を `ApprovalChainBlockedReason | "INACTIVE"` に拡張
- 採用理由: `ApprovalChainBlockedReason`（`NO_SUPERIOR_ROLE` 等）はドメインサービス
  `ApprovalChainBuilder` の語彙＝「承認チェーンが組めない理由」。INACTIVE は
  チェーン構築以前の「バリエーション状態」の問題で原因が異なる。専用 kind に分けることで
  ドメインサービスの語彙を汚さず、UI 分岐も意味論的に明確になる。

### 判定の配置順 — ローダー直後・assembleApprovalChain の前（判断不要）
- Submit と同じく `targetVariationIsActive` を判定の起点に置く（Issue 明記）。
  Preview でもローダー直後・組立て前で早期 return し、INACTIVE 時は judge/チェーン構築を
  走らせない。Submit の順序（INACTIVE → 兄弟 → judge）と整合。

### スコープ — INACTIVE のみ（ユーザー確認済み）
- 兄弟前進チェック（1見積1前進）の Preview/Submit 食い違いは同種の問題だが本Issueの
  スコープ外。今回は `targetVariationIsActive` の消費漏れだけを閉じる。

## ステップ

### Step 1: Preview 結果 DTO に INACTIVE kind を追加し Query で早期 return（TDD: RED→GREEN）
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/__tests__/PreviewApplicationQuery.test.ts`
  - `src/server/subdomains/estimate/application/queries/dto/PreviewApplicationResultDTO.ts`
  - `src/server/subdomains/estimate/application/queries/PreviewApplicationQuery.ts`
- 作業内容:
  - RED: `SubmitApplicationCommand.test.ts:177-194` を参考に、
    `buildNewEstimate(ids.estimate, EN.inactive, { variationNumbers: [1, 2] })` で
    複数バリエーションを作り `built.deactivateVariation(targetVariationId)` で対象を無効化。
    Preview 結果が `{ kind: "INACTIVE" }` であること、副作用（申請行・免除行）が無いことを検証。
  - GREEN: DTO の判別共用体に `| { kind: "INACTIVE" }` を追加。
    `PreviewApplicationQuery.execute` で `loadApprovalChainInputs` 直後・
    `assembleApprovalChain` の前に
    `if (!loaded.targetVariationIsActive) return { kind: "INACTIVE" };` を置く。
- コミットメッセージ: `fix: 申請プレビューがINACTIVEバリエーションを弾かずSubmitと可否が食い違う (#442)`

## 影響範囲の確認

- `PreviewApplicationResultDTO` / `PreviewApplicationQuery` の利用箇所は factory とテストのみで、
  プレゼンテーション層（API route / server action / UI モーダル）には未接続。よって UI 側の
  網羅的 switch などの破壊は無く、変更はアプリ層内で完結する。
- DDD レイヤリング: 変更はアプリ層（queries/dto）のみ。ドメイン層・ドメインサービスの型
  （`ApprovalChainBlockedReason`）には一切手を入れない。

## 検証

```bash
pnpm test src/server/subdomains/estimate/application/queries/__tests__/PreviewApplicationQuery.test.ts
pnpm lint
```

- 新規 INACTIVE テストが green になること。
- 既存4ケース（EXEMPT / REQUIRED / BLOCKED(NO_SUPERIOR_ROLE) / 副作用なし）が回帰しないこと。
- 型チェックで DTO の判別共用体追加が破綻しないこと。
