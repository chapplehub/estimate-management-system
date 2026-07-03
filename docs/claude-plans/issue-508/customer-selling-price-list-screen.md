# Issue #508: 得意先別販売単価 一覧画面（得意先検索 + 商品×現在単価一覧） — 実装計画

## 概要

得意先別販売単価の一覧画面を実装する（親 #492 の FE 分割・#506 の読みモデルを消費）。

- `/customer-selling-prices`（得意先未選択）: 「得意先を選択してください」の案内＋得意先セレクタのみ。商品一覧は出さない。
- `/customer-selling-prices/[customerCd]`（得意先選択済み）: 選択得意先の「価格保守対象商品 × 現在有効な得意先別単価」一覧。共通単価を並記し、行から管理画面（#507）へ遷移する。
- BE は実装済みの `CustomerSellingPriceListQueryService`（#538）をファクトリ経由で Server Component から直呼びする（ADR-0069・DTO 直 import・変換層なし #473）。
- テストは E2E 1本＋`seed-e2e.ts` へのフィクスチャ追加。/tdd（red-green-refactor）で、E2E スペックを先に書いて red を確認してから画面を実装する。

## 設計判断

/grill-with-docs セッション（2026-07-03）で合意済み。イシューの未決事項4点を含む。

### 得意先の選択状態の置き場
- A. クエリパラメータ（`?customer=C001`）
- B. パスセグメント（`/customer-selling-prices/[customerCd]`）
- C. 画面 state（クライアント）
- 採用: B。理由: (1) 管理画面 `/customer-selling-prices/[customerCd]/[productCd]`（#507）との階層整合。(2) 封筒型 DTO `null` → `notFound()` がパスの 404 として自然（#506 の BE 設計が想定する使い方）。(3) 未選択時の初期表示が「得意先なしルート＝案内画面」として構造的に決まる。C は URL 駆動 Server Component 規約に反するため除外。
- 検索条件（商品コード・商品名・単価状態）は従来どおりクエリパラメータ（`SearchForm` 規約）。パスに持つのは得意先のみ。

### 得意先セレクタの方式
- A. 検索付きコンボボックス／オートコンプリートを新設（イシュー起票時の文言）
- B. 既存 `SelectionModal` ＋ Server Action `searchCustomersForSelection` の流用
- 採用: B。理由: リポジトリにオートコンプリート部品は存在せず、得意先選択は見積作成・見積ヘッダ編集とも `SelectionModal` 方式。部品の原子で統一する方針（#351）に沿う。新規コンボボックスは隠れたスコープ膨張。選択の仕事は「得意先を1件確定して `router.push` する」だけなのでモーダルで十分。一覧画面にも切り替え用に同じ動線を置く。

### 共通単価（フォールバック層）の対比表示
- A. 出さない
- B. 独立カラムとして並記する
- 採用: B。理由: DTO の `currentCommonSellingPrice` は #506 がこの画面のために用意した並記カラム（COALESCE しない）。`none`（上書きなし）行では共通単価がないと「実際いくらで売られるか」が読めず、上書き設定要否の判断材料が消える。価格決定の2段フォールバックが画面構造にそのまま写る。

### 単価状態フィルタの選択肢
- A. 共通一覧の字面ミラー（「すべて／未設定のみ」の2択相当）
- B. 「すべて／有効／失効中／上書きなし」の4択セレクト
- 採用: B。理由: BE の `find` が `priceStatus`（active/lapsed/none）の単一値フィルタを実装済みで、FE は選択肢を増やすだけ。共通一覧の2択は `unset` の異常性（要保守アクション）に特化した非対称設計であり、`none` が正常状態のこの画面には妥当しない。ラベルは正準語「上書きなし」（「未設定」は共通層専用語のため不使用）。

### 管理画面への遷移方式
- A. 行クリック（イシュー起票時の文言）
- B. 商品コードセルの `<Link>`（共通一覧と同型）
- 採用: B。理由: 共有 `DataTable` は行クリックを持たず、行クリック化は共有部品への機能追加（スコープ膨張）。`<Link>` は新規タブ操作・a11y が標準で効く。リンクは全行対象: `active`/`lapsed` 行は編集へ、`none` 行は新規登録動線（編集読みモデルの `version: null`＝新規登録モードに接続）。#507 未着地の間は一時 404（親 #492 で織り込み済みの順序依存）。

### 無効エンティティの扱い
- A. 無効得意先・無効商品を弾く（`notFound()`／除外）
- B. 弾かずバッジで可視化
- 採用: B。理由: DTO が `customerIsActive`（「無効得意先の一覧ヘッダのバッジ表示用」と明記）・行 `isActive` を既に持ち、BE の設計意図が「隠さず・弾かず・バッジ」。無効商品行は共通一覧と同型で商品名列に「無効」バッジ、リンクも生かす（失効前上書きの棚卸しは保守業務としてあり得る）。セレクタ検索は有効得意先のみ（`searchCustomersForSelection` が `isActive: true` 固定）のため、無効得意先へは直接 URL のみで到達可＝「新規に選ぶ動線には出さないが状況確認は拒まない」非対称。

### テストのスコープ
- A. ユニットテスト＋E2E
- B. E2E 1本＋シード拡張のみ（ユニットテストなし）
- 採用: B。理由: 一覧画面は `*-list.e2e.ts` 1本が既存慣例で、`columns.tsx` 等の表示部品にユニットテストを置いていない（表示ロジックの検証は E2E に寄せる方針）。ページは Server Component の素通し描画で、バッジ出し分けは実データと一緒に E2E で見るのが整合的。CRUD ではなく閲覧のみなので `test.describe.serial` 不要。テスト内 Prisma 直接使用禁止（ADR-0012）。

### 既存規約への追随（判断不要のもの）
- 期間表示: 共有 `formatPeriod`（排他上端の生値を表示・#501/#513 で決定済み）
- ページング: 共有 `DataTable` 内蔵のクライアントページング
- 入口: ダッシュボードに「得意先別販売単価管理」カードを追加（既存カードリスト方式へ追随）
- `referenceDate` は `toJstCalendarDay` で「今日」を注入（ADR-20260627-86b）
- ADR は起票しない（後から驚く不可逆なトレードオフに該当なし。判断理由は本ファイルとコミットボディに残す）

## ステップ

/tdd の red-green-refactor で進める。E2E スペックは Step 2 で先に書き、対応画面の green と同じコミットに含める（red なスペックを単独コミットすると `pnpm e2e` が壊れるため）。

### Step 1: E2E シードに得意先別販売単価フィクスチャを追加
- 対象ファイル: `prisma/seed-e2e.ts`
- 作業内容:
  - 既存 `seedCommonSellingPrices` と同型の today 相対 raw insert で、1得意先に対し active／lapsed／none の3状態が揃う最小フィクスチャを追加（ADR-20260629-3x5）
  - 失効行は集約の `assertStartNotPast` を通せないため raw insert 必須（共通側と同じ制約）
  - 対象商品は共通単価あり／なしの両方を含め、共通単価並記カラムの表示分岐も踏めるようにする
- コミットメッセージ: `test: E2Eシードに得意先別販売単価の3状態フィクスチャを追加`

### Step 2: E2E スペック作成（red）
- 対象ファイル: `src/app/(features)/customer-selling-prices/customer-selling-prices-list.e2e.ts`
- 作業内容:
  - 検証ケース: 未選択画面の案内表示／モーダルで得意先検索・選択→一覧遷移／一覧表示（active=金額・lapsed=「失効中」バッジ・none=「上書きなし」バッジ・共通単価並記・適用期間）／検索条件（コード・名前・状態4択フィルタ）／存在しない得意先コード直打ちで 404／無効バッジ表示
  - 画面未実装のため red を確認する（コミットは Step 3・4 の green と合わせる）
- コミットメッセージ: （単独コミットなし。Step 3・4 に含める）

### Step 3: 未選択画面＋ダッシュボード入口（green・前半）
- 対象ファイル:
  - `src/app/(features)/customer-selling-prices/page.tsx`（新規）
  - 得意先選択クライアントコンポーネント（`SelectionModal` + `searchCustomersForSelection` を配線し、選択で `router.push`）
  - `src/app/(features)/dashboard/page.tsx`（カード追加）
- 作業内容:
  - 「得意先を選択してください」の案内＋セレクタのみの画面を実装
  - ダッシュボードに「得意先別販売単価管理」カードを追加
  - 該当 E2E ケース（案内表示・モーダル選択→遷移）の green を確認
- コミットメッセージ: `feat: 得意先別販売単価の得意先未選択画面とダッシュボード入口`

### Step 4: 得意先別一覧画面（green・後半）
- 対象ファイル:
  - `src/app/(features)/customer-selling-prices/[customerCd]/page.tsx`（新規・Server Component）
  - `src/app/(features)/customer-selling-prices/[customerCd]/_components/columns.tsx`（新規）
  - 検索フォーム配線（共有 `SearchForm`・状態4択セレクト）
- 作業内容:
  - `customerSellingPriceListQueryFactory()` を直呼びし、`find({ customerCode, referenceDate, code?, name?, priceStatus? })` の結果を描画。封筒 `null` は `notFound()`
  - ヘッダに得意先名・コード（無効なら「無効」バッジ）、切り替え用セレクタを設置
  - カラム: 商品コード（`<Link href=/customer-selling-prices/[customerCd]/[productCd]>`）｜商品名（無効バッジ）｜得意先別 現在単価（active=金額／lapsed=失効中バッジ／none=上書きなしバッジ）｜適用期間（`formatPeriod`）｜共通単価
  - 検索条件はクエリパラメータ→BE 絞り込み（FE 全件絞り込みをしない #473）
  - 残りの E2E ケースの green を確認
- コミットメッセージ: `feat: 得意先別販売単価の一覧画面（商品×現在単価・共通単価並記）`

### Step 5: リファクタと全体確認
- 対象ファイル: Step 3・4 の成果物
- 作業内容:
  - 共通一覧との重複が意味のある単位で括れる場合のみ共有化を検討（字面一致だけの早すぎる抽象化はしない）
  - `pnpm lint`・`pnpm e2e` の全体 green を確認
  - 計画からの逸脱があれば `docs/claude-plans/issue-508/deviations.md` に記録
- コミットメッセージ: （リファクタ内容に応じて `refactor:`。変更なしならコミットなし）
