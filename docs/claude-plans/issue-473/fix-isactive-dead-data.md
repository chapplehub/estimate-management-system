# 計画: 編集画面の isActive デッドデータ解消（無効バッジ追加）— #473 レビュー指摘

## Context（なぜやるか）

PR #480 の自己レビューで確定した唯一の指摘の修正。`CommonSellingPriceEditDTO.isActive` は
コメントで「無効商品の編集時バッジ表示用」と明記されフェッチ・伝搬されているが、詳細画面
（`page.tsx` / `PeriodDetailPanel.tsx`）に描画箇所がゼロ＝**デッドデータ**。

一方で一覧 `columns.tsx:31` は無効商品に「無効」バッジを出しており、**一覧と詳細で無効商品の
見え方が食い違う**。DTO の当初意図（編集時バッジ表示）どおり、詳細画面にも無効バッジを足して
一貫性を回復する。

severity は低（無効商品という縁ケース限定の表示欠落・機能/データ整合性のバグではない）。

## 設計判断（ユーザー確認済み）

- **解消方針: 案A＝詳細にも無効バッジを追加**（案B＝DTOから削除 ではない）。
  - 根拠: DTO コメントの当初意図を尊重し、一覧（`columns.tsx`）と無効商品の見え方を揃える。
    `isActive` を生きたデータにする。編集DTOと一覧DTOは別物のため一覧側への影響なし。
- **バッジ位置: 商品名の右隣**（一覧 `columns.tsx:31` と同一配置）。
  - 商品情報 dl の「商品名」値（`page.tsx:49`）の直後に `!isActive` のとき `<Badge variant="outline">無効</Badge>`。
- **描画レイヤ: Server Component（`page.tsx`）側で描画**。
  - `Badge` は `"use client"` 指定なし・フックなしの純粋 span ラッパ（`badge.tsx`）で Server Component から
    直接利用可。`PeriodDetailPanel`（client）へ追加伝搬する必要はなく、`detail.isActive` を `page.tsx`
    内で消費する方が結合が少ない。`PeriodDetailPanel` は無変更。

## 実装ステップ（1ステップ＝1コミット）

### Step 1: 詳細画面の商品名右隣に無効バッジを追加
- `src/app/(features)/common-selling-prices/[productCd]/page.tsx`:
  - `Badge`（`@/app/_components/shadcnui/badge`）を import。
  - 商品情報 dl の「商品名」`<dd>`（現 `page.tsx:48-50`）を、商品名テキスト＋`!detail.isActive && <Badge variant="outline">無効</Badge>`
    を横並び（`flex items-center gap-2`）にする。一覧 `columns.tsx:28-32` の構造に合わせる。
  - 既存の商品情報レイアウト（grid dl）・戻るリンク・`PeriodDetailPanel` 呼び出しは無変更。

## 検証（end-to-end）

- `pnpm lint` / `pnpm build`: 型・client/server 分離（Server Component での `Badge` 使用）の健全性。
- `pnpm test`: 影響なし（読みモデル/コマンドのロジック不変）だが回帰確認のため全件実行。
- 手動E2E（playwright MCP・dev server）:
  - 無効商品（`isActive=false`）の詳細を開き、商品名の右隣に「無効」バッジが出ること。
  - 有効商品ではバッジが出ないこと。
  - 一覧⇔詳細で無効商品の見え方が一致すること。
  - seed 注意: 共通売単価 seed の PRD001/PRD002 は有効商品。無効商品が seed に無ければ、検証用に
    一時的に商品を無効化するか、無効商品＋未設定の組み合わせで詳細を開いて確認し、検証後に dev DB を
    元へ復旧する（共有 dev DB 方針）。

## スコープ外
- 一覧側 `columns.tsx` の無効バッジ（既存・不変）。
- 編集DTO/QueryService の `isActive` フィールド定義（案B不採用＝削除しない）。
- ILIKE の `%`/`_` 未エスケープ（本PRスコープ外の app 全体の潜在事項・別途イシュー化の候補）。

## 残課題
- なし（単一ファイルの表示追加）。逸脱が出た場合のみ deviations.md へ追記。
