# Issue #507: 得意先別販売単価 管理画面（登録・編集・適用終了・削除 + 改訂ウィザード + タイムライン） — 実装計画

## 概要

得意先別販売単価の管理画面（第3階層 `/customer-selling-prices/[customerCd]/[productCd]`）を実装する。
共通販売単価の管理画面（`common-selling-prices/[productCd]/`）を**ディレクトリごとコピー写像**し、
得意先軸の差分（route パラメータ・宛先キー・上書きなしの意味論）を織り込む。
タイムラインには共通販売単価をフォールバック層（表示専用の第2レーン）として重ねて対比する。

BE は完成済み（#505 書き込みコマンド5種 / #506 読みモデル）で、本イシューは FE のみ。
一覧画面は #508、E2E テストは #509 で別イシュー。

## 設計判断

### 共通販売単価画面の流用方針
- A. ディレクトリごとコピー写像し、`_shared` の原子（`authorityFor`・`computeTimelineLayout`・`formatPeriod`・`formatYen`）のみ共有を続ける
- B. PeriodDetailPanel 等を汎用部品化し、DTO・Server Actions を props 注入する
- 採用: A。BE の完全同型写像方針（ADR-20260627-a5c: 型は集約ごとに独立複製し共有しない）と対称にする。
  得意先別特有の要素（customer identity 表示・上書きなしの意味の違い・共通単価の並記）が
  条件分岐 props として汎用部品に漏れ込むのを避ける。抽象化は納品先別（3例目）が出てから。
  コピー写像の実コスト（共通側のバグ修正が伝播しない。例: #535 のような修正は2画面それぞれに手当てが要る）は許容する。

### タイムラインへの共通単価フォールバック層の重ね表示
- A. 本イシューに含める（表示専用の控えめな第2レーン）
- B. 後続イシューに切り出し、#507 は純粋な同型写像に保つ
- 採用: A。この画面の存在意義は「価格決定」の2段フォールバック（得意先別→共通）であり、
  上書き期間の外で何が適用されるかが一目で分かる。#506 の一覧 DTO が共通単価を
  「COALESCE せず独立カラムで並記」とした思想の延長。データは既存
  `commonSellingPriceEditQueryFactory` を page から並行取得でき BE 追加実装ゼロ。
- 限定事項:
  - 共通レーンは表示のみ（クリック・操作なし、淡色で従属的に描画）
  - 共通単価への編集導線は張らない
  - 共通が未設定でもレーンを空表示するだけで、警告等の新 UI は作らない

### `computeTimelineLayout` の複数レーン対応
- A. 後方互換の拡張（既存の単レーン呼び出しはそのまま動く形で、両レーンの和集合から軸範囲を決められるようにする）
- B. 得意先別専用のレイアウト関数を別に作る
- 採用: A。`_shared` の原子は共通単価・原価画面も使っているため、既存呼び出しに影響を出さない
  オプション引数等の形で拡張する。純関数なので単体テストで TDD する（下記 Step 3）。

### 「上書きなし」状態の画面表現
- A. 中立の空状態（警告なし・情報提供トーン・登録ボタンは通常提示）
- B. 共通画面の「適用期間が未設定です。…価格決定が解決できません。」表現を写像する
- 採用: A。CONTEXT.md の定義どおり「上書きなし」は異常状態ではなく保守アクションも要求しない
  正常な派生状態（共通層の「未設定」と正反対の意味論）。文言は
  「この得意先×商品の上書きはありません。価格決定は共通販売単価を適用します。」の情報提供トーン。
  タイムラインは上書きなしでも描画し、共通レーンのみが表示される（フォールバックがそのまま見える）。
  共通も空の場合に警告 UI は作らない（共通層の保守問題であり、この画面の関心ではない）。
  #536 のような設定誘導バナーは出さない（上書きは義務ではない）。

### 一覧不在期間の戻りリンク
- A. 最初から「← 得意先別販売単価一覧に戻る」リンクを入れ `/customer-selling-prices` を指す（#508 出荷まで 404 許容）
- B. #507 では省略し、#508 実装時に追記する
- 採用: A。#508 が出るまでこの詳細画面への導線は直 URL のみで、死リンクを踏む動線が実質存在しない。
  省略すると #508 が #507 の画面に触る跨ぎ作業が発生し忘れやすい。
  一覧が得意先選択状態を持つ設計になったら、そのときにクエリパラメータを足す（#508 の関心）。

### フォーム統一・権限の FE 表現（判断不要・前例踏襲）
- フォーム統一: `PeriodForm` の3モード構造（`new`/`edit`/`endDate` の単一フォーム切替）の写像で自動的に充足
- 権限: `authorityFor`（時点状態）× `isAdmin`（セッション）の前例踏襲。
  `period-rules.ts` は得意先別販売単価を既に想定済みで、フォークしない

## TDD 適用方針

- **新規ロジックは `computeTimelineLayout` の複数レーン共有軸対応のみ**。純関数であり
  `_shared/timeline-layout.test.ts` の前例があるため、ここは red-green-refactor で進める（Step 3-1）。
- コピー写像部分（画面部品・actions・schema）にはコンポーネントテストの前例がなく、
  挙動担保は #509 の E2E が担う。写像部分にテストを新設する逸脱はしない。

## ステップ

### Step 1: 基本操作（登録・編集・適用終了・削除）
- 対象ファイル:
  - `src/app/(features)/customer-selling-prices/[customerCd]/[productCd]/page.tsx`（新規）
  - 同 `PeriodDetailPanel.tsx` / `PeriodForm.tsx` / `PeriodDeleteConfirm.tsx`（新規・写像）
  - 同 `actions.ts`（新規: add / updateFuture / endDate / delete の4 action）
  - 同 `schema.ts`（新規: 対応する zod スキーマ）
- 作業内容:
  - `common-selling-prices/[productCd]/` からコピー写像し、宛先キーを `(customerId, productId)` 複合に差し替え
  - page: `customerSellingPriceEditQueryFactory` で Edit DTO を取得、`null` なら `notFound()`。
    ヘッダに得意先・商品の identity（コード・名称・有効バッジ）を表示。
    戻りリンクは `/customer-selling-prices` を指す
  - actions: #505 の factories（register / edit / endDate / delete）に接続し、`customerId` + `productId` を bind
  - 空状態（`version: null` + `periods` 空）は中立文言
    「この得意先×商品の上書きはありません。価格決定は共通販売単価を適用します。」で表現（警告 UI なし）
  - conform の空文字→undefined 変換規約に従い、必須でない string は `.optional()`（写像元の規約踏襲）
- コミットメッセージ: `feat: 得意先別販売単価 管理画面の基本操作（登録・編集・適用終了・削除） (#507)`

### Step 2: 改訂ウィザード
- 対象ファイル:
  - 同 `ReviseForm.tsx`（新規・写像）
  - 同 `actions.ts` / `schema.ts`（revise action + スキーマ追記）
- 作業内容:
  - `ReviseForm` を写像し、`reviseCustomerSellingPricePeriodCommandFactory` に接続
  - `PeriodDetailPanel` の `PanelMode` に `revise` を配線（写像元と同構造）
- コミットメッセージ: `feat: 得意先別販売単価 改訂ウィザード (#507)`

### Step 3-1: タイムライン帯レイアウトの複数レーン共有軸対応（TDD）
- 対象ファイル:
  - `src/app/(features)/_shared/timeline-layout.ts`
  - `src/app/(features)/_shared/timeline-layout.test.ts`
- 作業内容:
  - Red: 「2系列の期間の和集合から軸範囲（axisStart / axisEnd / todayPct）を決め、
    各系列の bars を同一軸上に配置する」テストを先に書く
  - Green: 後方互換の形（オプション引数等）で `computeTimelineLayout` を拡張
  - Refactor: 既存の単レーン呼び出し（共通単価・原価画面）のテストが全て通ることを確認
- コミットメッセージ: `feat: タイムライン帯レイアウトに複数レーン共有軸対応を追加（後方互換拡張） (#507)`

### Step 3-2: タイムライン帯表示（共通単価レーン並記）
- 対象ファイル:
  - 同 `PriceTimeline.tsx`（新規・写像 + 2レーン化）
  - 同 `page.tsx` / `PeriodDetailPanel.tsx`（共通 DTO の取得・受け渡し）
- 作業内容:
  - page で `commonSellingPriceEditQueryFactory` を並行取得し、共通期間行をタイムラインへ渡す
  - 得意先別レーン（主・操作対象）+ 共通レーン（従・淡色・表示専用）の2段描画
  - 上書きなし状態でもタイムラインを描画（共通レーンのみ表示）
- コミットメッセージ: `feat: 得意先別販売単価 タイムライン（共通単価レーン並記） (#507)`
