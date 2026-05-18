# Issue #262: delivery-locations e2e の create-e2e-test スキル準拠（chain分離） — 実装計画

## 概要

`delivery-locations-crud.e2e.ts` の単一 serial chain（作成→詳細→更新→無効化→
有効化→削除の 6 ステップ）を create-e2e-test skill §4/§9 に準拠させ、
「ライフサイクル chain」と「ステータス管理 chain」の 2 chain に分離する。

加えてユーザー追加要望として、Issue #261（PR #270）の共通シード変更
（`C901`/配下 `D901` 追加・`D901` は active）により破綻した
`delivery-locations-list.e2e.ts` の `状態「有効」で検索できる` テストの
脆い件数アサーション `expect(count).toBe(6)` を PR #270 と同一パターン
（`toBeGreaterThan(0)` + 全行一致不変条件）へ堅牢化する。

## 設計判断

### list 修正のスコープ
- A. list の全 `toHaveCount`/`toBe` を一括堅牢化
- B. #261 で実際に壊れた `expect(count).toBe(6)`（line 91）のみを修正
- 推奨: **B**。ユーザー指示が当該アサーションを明示。直接前例 PR #270 も
  `customers-list` で壊れた箇所のみ修正（健全な count は不変）。他の
  `toHaveCount` は D901 の影響を受けず green のため変更しない。

### §13 独自シードの追加
- 追加しない。delivery-locations-crud にドメインエラーテストが存在しない
  （重複コードは §3 簡易エラー・共通シード D001・DB 不変）。customers
  （#261）と異なり `seed-e2e.ts` は無変更（Issue #250 既存構造不変原則）。

### ステータス管理 chain の作成ステップ
- 最小フォーム入力（取引先コード・名前・得意先のみ）。フィールド網羅は
  ライフサイクル chain の関心事であり §4「1 chain = 1 関心事」に従い重複を
  避ける（`customers-crud.e2e.ts` PR #270 の前例に準拠）。

## ステップ

### Step 1: crud serial chain を §4/§9 準拠で分離
- 対象ファイル: `src/app/(features)/delivery-locations/delivery-locations-crud.e2e.ts`
- 作業内容:
  - 定数追加 `TEST_STATUS_DL_CD = "DL903"` / `TEST_STATUS_DL_NAME`、既存
    `TEST_DL_CD = "DL901"` を §9 chain1 用とコメント明示
  - 単一 chain を `test.describe.serial("ライフサイクル")`（作成→詳細→更新→
    削除・4 ステップ）と `test.describe.serial("ステータス管理")`（作成→無効化
    →有効化→削除・DL903・4 ステップ）へ分離
  - `重複する取引先コード`（§3 簡易エラー）と一般ユーザー簡易 chain は変更しない
- コミットメッセージ: `test: delivery-locations crud e2e の serial chain を分離（§4/§9 準拠）`

### Step 2: list の脆い件数アサーションを堅牢化（#261 seed 追従）
- 対象ファイル: `src/app/(features)/delivery-locations/delivery-locations-list.e2e.ts`
- 作業内容: line 91 の `expect(count).toBe(6);` を
  `expect(count).toBeGreaterThan(0);` + 不変条件コメントへ。全行「有効」
  ループ（line 92-94）は維持
- コミットメッセージ: `test: delivery-locations-list の脆い件数アサーションを堅牢化（#261 seed 追従）`

### Step 3: 逸脱を記録
- 対象ファイル: `docs/claude-plans/issue-262/deviations.md`
- 作業内容: Issue #262 文言は crud のみ対象。list 修正はユーザー追加要望に
  よるスコープ拡大であることを PR #270 の `issue-261/deviations.md` に倣い記録
- コミットメッセージ: `docs: Issue #262 の逸脱（list e2e スコープ拡大）を記録`

## 完了条件

- どの chain も §4 の最大 5 テスト以内
- ステータス管理が独立 chain（§9）
- `delivery-locations-list.e2e.ts` の脆い件数アサーションが堅牢化済み
- `seed-e2e.ts` は無変更
- `pnpm e2e` がグリーン
