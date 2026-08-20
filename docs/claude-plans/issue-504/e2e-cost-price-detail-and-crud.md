# Issue #504: 原価 一覧・保守画面のE2Eテスト作成（seed帯追加含む） — 実装計画

## 概要

原価保守画面（#503/#524 で実装済み）の E2E テストを、共通販売単価 E2E（#481/PR #486）の完全同型ミラーとして作成する。新規作成は `cost-prices-detail.e2e.ts` / `cost-prices-crud.e2e.ts` の2ファイルと `prisma/seed-e2e.ts` への原価用フィクスチャ追加。

- 一覧 E2E（`cost-prices-list.e2e.ts`）は #501 で作成済みのため**本 issue のスコープ外**。seed 追加の影響が出た場合のみ追随修正する
- 原価保守画面の UI は売単価保守画面と完全同型ミラーであることを確認済み（`PeriodDetailPanel` / `PriceTimeline` の構造・`data-testid` まで一致）
- 用語は CONTEXT.md 準拠で「単価改定」を使う（「改訂」は見積系の予約語のため使用禁止。Issue 本文の「改訂ウィザード」は「単価改定」のこと）
- ルール源: ADR-0012（Prisma 直接使用禁止・UI 経由検証）/ ADR-0017（ヘッダー名ベースのセル特定）/ ADR-0020（chain 粒度・並列/直列分類）/ ADR-20260629-3x5（today-relative seed）

## 設計判断

### 一覧 E2E の扱い
- A. Issue 記載どおり一覧 E2E も本 issue で作成・拡張する
- B. 既存（#501 作成済み・7シナリオ）を維持し、seed 追加の影響が出た場合のみ追随修正する
- 採用: B（Issue 起票後に #501 側で先行実装済み。スコープ項目「検索・絞り込み・状態バッジ・遷移」をカバー済みのため）
- 影響分析: 一覧「未設定のみ」シナリオは包含検証（PRD843 可視 / PRD840 不可視 / 可視セル全て「未設定」）であり、新規 PRD845〜847 は CRUD チェーン並走中のどの時点でも「未設定として表示（ループ検証を通る）」か「filter=unset から除外（不可視）」のいずれかで矛盾しない。表示とフィルタは同一クエリサービス由来。**修正不要の見込みだが、Step 4 で実行確認する**

### 商品コード帯（Issue 未決事項 1）
- A. 新帯（PRD85x 等）を切る
- B. 既存の原価用 PRD84x 帯（840〜843 使用済み）を PRD844〜847 へ拡張する
- 採用: B（帯は機能単位で予約する運用。`d57114a` の教訓は帯間の混用の話であり、同一機能内の連番拡張は規約に沿い衝突リスクもない。PRD844〜849 は空きを確認済み）

### 詳細 E2E のシナリオ構成
- A. 売単価 detail と同型の 9 シナリオのみ
- B. A に加えて「未設定商品の詳細画面」シナリオを追加
- 採用: A（未設定→登録の振る舞いは CRUD Chain A の起点が実質検証する。売単価側にも当該シナリオはなく対称性が保たれる）

### PRD844 のフィクスチャ値
- A. 売単価 PRD820 と同一値・同一オフセットの完全ミラー（¥1,000/¥2,000/¥3,000）
- B. 原価らしい別の値にする
- 採用: A（詳細 E2E は画面上の金額文字列をアサートするため、値まで揃えると雛形との diff が商品コードと文言だけになり突合・保守が最も楽。ページが別なのでロケータ衝突なし）

### CRUD E2E の構成・検証手段
- 売単価 crud E2E（5 describe / 11 テスト）の完全同型ミラー、検証は UI 経由（画面リロード・再表示）——既存パターン踏襲のため判断不要（Issue 未決事項 4 の解決）

## フィクスチャ設計（Issue 未決事項 2・3 の解決）

| 商品 | 用途 | 期間・単価（today 相対・JST） | 投入方式 |
|---|---|---|---|
| PRD844 | 詳細3状態表示・重複拒否（DB不変） | 失効 `[t-60,t-30)` ¥1,000 / 現在有効 `[t-30,t+30)` ¥2,000 / 将来 `[t+30,∞)` ¥3,000 | 失効行は raw daterange insert（既存 `seedCostPrices` 方式） |
| PRD845 | CRUD Chain A（登録→編集→削除） | 商品行のみ・原価集約なし（`costPrice: null`） | products 定義のみ |
| PRD846 | CRUD Chain B（登録→適用終了→改定で将来期間追加） | 同上 | 同上 |
| PRD847 | Chain C（ガイド付き単価改定・UC-6） | 同上 | 同上 |

売単価側との対応: PRD844↔PRD820、PRD845↔PRD822、PRD846↔PRD824、PRD847↔PRD825。

## ステップ

### Step 1: seed-e2e への原価フィクスチャ帯追加
- 対象ファイル: `prisma/seed-e2e.ts`
- 作業内容:
  - PRODUCTS に PRD844〜847 を追加（命名は既存 `COST_` プレフィックス踏襲、全て `costPrice: null`）
  - `seedCostPrices()` を拡張し PRD844 の3期間を投入（失効行は raw daterange insert、ADR-20260629-3x5 の `jstRelativeDate` 使用）
  - 帯コメントを「原価 一覧 E2E 用（#501）」→「原価 E2E 用（#501/#504）」に更新
  - `pnpm e2e:seed` で投入確認
- コミットメッセージ: `test: seed-e2e に原価保守E2E用フィクスチャを追加（PRD844〜847）`

### Step 2: 詳細 E2E（cost-prices-detail.e2e.ts）
- 対象ファイル: `src/app/(features)/cost-prices/cost-prices-detail.e2e.ts`（新規）
- 作業内容:
  - `common-selling-prices-detail.e2e.ts` の同型ミラーで 2 describe / 9 シナリオを作成（PRD844 使用・並列・DB不変）
  - UC-2 6本: 3状態バッジ / 将来行=編集・削除のみ / 現在有効行の操作出し分け / 失効行=「—」 / 戻りリンク / 404
  - タイムライン 3本: 既定テーブル表示 / 切替で帯・今日マーカー・凡例（`data-testid` は売単価と同一） / テーブルへ戻すと帯が消える
  - 文言は「原価」・「単価改定」、日付突合は `jstRelativeDate()` 同型実装
- コミットメッセージ: `test: 原価 保守画面（詳細・タイムライン）のE2Eテスト`

### Step 3: CRUD E2E（cost-prices-crud.e2e.ts）
- 対象ファイル: `src/app/(features)/cost-prices/cost-prices-crud.e2e.ts`（新規）
- 作業内容:
  - `common-selling-prices-crud.e2e.ts` の同型ミラーで 5 describe / 11 テストを作成
  - Chain A（serial・PRD845）: 将来期間の登録→編集→削除で未設定に戻る
  - Chain B（serial・PRD846）: 現在有効期間の登録→適用終了→改定として将来期間追加
  - Chain C（serial・PRD847）: 登録→改定ボタンからガイド付き単価改定（UC-6）
  - ドメインエラー（並列・PRD844・DB不変）: 重複登録のフォーム拒否
  - 一般ユーザー（並列・`playwright/.auth/user.json`）: 閲覧可＋ミューテーション系UI非表示
- コミットメッセージ: `test: 原価 保守画面（CRUD・単価改定・権限）のE2Eテスト`

### Step 4: 全 E2E 実行と一覧テスト影響確認
- 対象ファイル: （必要な場合のみ）`src/app/(features)/cost-prices/cost-prices-list.e2e.ts`
- 作業内容:
  - `pnpm e2e` で全スイート実行（既存一覧・売単価系の並走を含めて通ることを確認）
  - 一覧「未設定のみ」等に影響が出た場合のみ追随修正し、`docs/claude-plans/issue-504/deviations.md` に記録
- コミットメッセージ: （修正が発生した場合のみ）`test: 原価一覧E2Eをseed帯拡張へ追随修正`
