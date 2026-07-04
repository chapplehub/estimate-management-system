# Issue #548: 納品先別販売単価 一覧画面（納品先検索 + 商品×現在単価一覧） — 実装計画

## Context

親 #544 の分割のうち **FE 一覧画面**。得意先別 #508 と同型で、独立した納品先選択画面は設けず、一覧画面に納品先セレクタを持たせ、選択納品先の「価格保守対象商品 × 現在有効な納品先別単価」を一覧表示し、行から管理画面 #547 へ遷移する。

- 読みモデル BE（#546 相当）は**完成済み**：`deliveryLocationSellingPriceListQueryFactory()`（`pricingQueryFactory.ts`）が封筒型 DTO（`DeliveryLocationSellingPriceListDTO`：納品先 identity ＋**親得意先 identity** ＋ 商品行配列）を返す。FE はこれをファクトリ経由で Server Component から直呼びする（DTO 直 import・変換層なし #473）。
- 遷移先の管理画面 #547 は**未実装**。行リンクの宛先 `/delivery-location-selling-prices/[deliveryLocationCd]/[productCd]` は一時 404（親 #544 の順序依存として織り込む）。
- 得意先別 #508 が完成済みで、本画面はそのほぼ完全な写し。実質差は「納品先セレクタの探し方（単独グローバル検索＋得意先列）」と「ヘッダに親得意先文脈を出す」の2点のみ。
- テストは E2E 1本 ＋ `seed-e2e.ts` へのフィクスチャ追加。/tdd（red-green-refactor）で E2E スペックを先に書いて red を確認してから画面を実装する。

## 設計判断

未決事項5点はユーザー確認（単独検索＋得意先列を採用）と完成済み BE 設計・参照実装 #508 で確定済み。

### 納品先の選択状態の置き場
- A. クエリパラメータ / B. パスセグメント `/delivery-location-selling-prices/[deliveryLocationCd]` / C. 画面 state
- **採用: B。** 読みモデル DTO が `route の [deliveryLocationCd]` を明記（納品先コードはグローバル一意で identity キー）。封筒型 DTO `null` → `notFound()` がパスの 404 として自然。未選択時が「納品先なしルート＝案内画面」として構造的に決まる。検索条件（商品コード／商品名／単価状態）は従来どおりクエリパラメータ。

### 納品先セレクタの方式（唯一の実質的分岐・ユーザー確認済み）
- A. 単独グローバル検索（全納品先を1モーダルで検索・候補に**親得意先列**を付与）／ B. 得意先→納品先の2段選択
- **採用: A（ユーザー選択）。** 得意先別 #508 と同型・最小クリック。既存 `SelectionModal` を流用しつつ、同名納品先（例「第一倉庫」）の曖昧性を候補の得意先列で解消する。
  - 既存 `searchDeliveryLocationsForSelection(customerId, criteria)`（`estimates/_shared/selection-actions.ts`）は customerId 必須（見積フロー用）で流用不可。下層 `DeliveryLocationSearchCriteria.customerId` は**任意**なので、customerId を渡さないグローバル検索の server action を新設する。
  - 配置は**フィーチャローカル**（`delivery-location-selling-prices/_components/`）。理由: グローバル（得意先非拘束）検索は本画面固有で、estimate 側 action の「選択中得意先で絞る」契約を薄めないため。返却行は customerName/customerCode を含む slim 行（`DeliveryLocationDTO` は両方を保持）。

### 共通単価（フォールバック層）の対比表示
- A. 出さない / B. 独立カラムとして並記
- **採用: B。** DTO の `currentCommonSellingPrice` は #546 が並記のために用意（COALESCE しない）。納品先の価格解決連鎖は `納品先別 ?? 共通`（得意先別は連鎖外）なので**共通のみ**並記する（得意先別列は出さない＝BE で確定済み）。`none`（上書きなし）行で「実際いくらで売られるか」が読める。

### 単価状態フィルタの選択肢
- **採用: 3択セレクト（有効=active／失効中=lapsed／上書きなし=none）。** BE の `find` が `priceStatus` 単一値フィルタを実装済み。ラベルは正準語「上書きなし」（「未設定」は共通層専用語のため不使用）。得意先別 #508 と同一。

### 管理画面 #547 への遷移方式
- **採用: 商品コードセルの `<Link>`（共通/得意先別と同型）。** 全行対象（active/lapsed=編集へ、none=新規登録動線）。宛先 `/delivery-location-selling-prices/[deliveryLocationCd]/[productCd]`。#547 未着地の間は一時 404。

### 無効エンティティの扱い
- **採用: 弾かずバッジで可視化。** DTO は `deliveryLocationIsActive`（無効納品先ヘッダバッジ用と明記）・行 `isActive` を保持。無効納品先はセレクタ検索（有効のみ）に出ないが直接 URL では到達可＝「新規に選ぶ動線には出さないが状況確認は拒まない」非対称。

### ヘッダの親得意先文脈
- **採用: 納品先名・コード ＋ 親得意先名・コードを併記。** 封筒 DTO が親得意先 identity を同梱しており（納品先は親得意先の文脈が無いと保守画面ヘッダで意味を成さない）、FE 側 code→id 二重取得は不要。

### クライアント wrapper の要否（#508 の逸脱を先回りで織り込む）
- **採用: `DeliveryLocationSellingPriceTable.tsx`（"use client" 薄 wrapper）を初手から用意。** カラム定義が deliveryLocationCode に依存する（リンクファクトリ `createColumns(deliveryLocationCode)`）ため、"use client" モジュールの関数を Server Component から直接呼べない RSC 制約を回避する（#508 で実行時エラーとして発覚した逸脱を計画時点で吸収）。

### 既存規約への追随（判断不要）
- 期間表示: 共有 `formatPeriod`（排他上端の生値・#513） / 金額: `formatYenFromDecimal`
- ページング: 共有 `DataTable` 内蔵クライアントページング / 検索: 共有 `SearchForm`
- 入口: ダッシュボードに「納品先別販売単価管理」カード追加
- `referenceDate` は `toJstCalendarDay(new Date())` で「今日」を注入（ADR-20260627-86b）
- テストスコープ: E2E 1本 ＋ シード拡張のみ（表示部品にユニットテストは置かない既存慣例）。閲覧のみ（DB 不変）で `test.describe.serial` 不要。テスト内 Prisma 直接使用禁止（ADR-0012）
- ADR は起票しない（不可逆なトレードオフに該当なし。判断理由は本ファイルとコミットボディに残す）

## ステップ

/tdd の red-green-refactor で進める。E2E スペックは Step 2 で先に書き、対応画面の green と同じコミットに含める（red なスペックを単独コミットすると `pnpm e2e` が壊れるため）。

### Step 1: E2E シードに納品先別販売単価フィクスチャを追加
- 対象ファイル: `prisma/seed-e2e.ts`
- 作業内容:
  - `seedCustomerSellingPrices`（C902 × PRD86x 帯）と同型の `seedDeliveryLocationSellingPrices` を新設。専用得意先 ＋ 専用納品先（例: 得意先 C903 ／ 納品先 DL903「E2E専用_納品先別単価テスト納品先」）を追加し、today 相対の raw insert で `deliveryLocationSellingPrice` に3状態（active/lapsed/none）が揃う最小フィクスチャを投入
  - 失効行は集約の `assertStartNotPast` を通せないため raw insert 必須。対象商品は共通単価あり／なしの両方を含め、共通単価並記カラムの分岐を踏める帯にする（得意先別 C902 帯と結合させないため専用商品帯 PRD87x を採る）
  - 無効納品先ヘッダバッジ検証用に、直接 URL で到達する無効納品先（例: DL904・inactive）を専用フィクスチャ内に用意（既存データへの相乗りを避け isolation を保つ）
  - 母集合に無効商品行（例: PRD87x の1件）を1件含める
- コミットメッセージ: `test: E2Eシードに納品先別販売単価の3状態フィクスチャを追加`

### Step 2: E2E スペック作成（red）
- 対象ファイル: `src/app/(features)/delivery-location-selling-prices/delivery-location-selling-prices-list.e2e.ts`（新規）
- 作業内容: #508 の `customer-selling-prices-list.e2e.ts` を写経し検証ケースを用意
  - 未選択画面の案内＋セレクタのみ（商品テーブル非表示）
  - モーダルで納品先を**グローバル検索**・**得意先列**の確認・選択 → 一覧遷移
  - 一覧表示: active=金額 / lapsed=「失効中」/ none=「上書きなし」/ 共通単価並記 / 適用期間（有界・無期限）
  - ヘッダに納品先名・コード ＋ 親得意先名・コード
  - 検索条件（商品コード部分一致・単価状態3択フィルタ）
  - 商品コードリンクの宛先 `/delivery-location-selling-prices/[deliveryLocationCd]/[productCd]` 検証（#547 未着地のため宛先属性のみ）
  - 無効商品行バッジ / 無効納品先ヘッダバッジ / 存在しない納品先コードで 404
  - 画面未実装のため red を確認（コミットは Step 3・4 の green に含める）
- コミットメッセージ: （単独コミットなし。Step 3・4 に含める）

### Step 3: 未選択画面＋納品先セレクタ＋ダッシュボード入口（green・前半）
- 対象ファイル:
  - `src/app/(features)/delivery-location-selling-prices/page.tsx`（新規・Server Component）
  - `src/app/(features)/delivery-location-selling-prices/_components/DeliveryLocationSelector.tsx`（新規・"use client"）
  - `src/app/(features)/delivery-location-selling-prices/_components/selection-actions.ts`（新規・"use server"：グローバル納品先検索 action）
  - `src/app/(features)/delivery-location-selling-prices/_components/selectionColumns.tsx`（新規：コード／名称／**得意先**列 ＋ 行型）
  - `src/app/(features)/dashboard/page.tsx`（カード追加）
- 作業内容:
  - グローバル納品先検索 action: `searchDeliveryLocationsQueryFactory().execute({ code?, name?, isActive: true }, { limit, orderBy: code asc })` を呼び、`{ id, code, name, customerCode, customerName }` の行にマップ（customerId は渡さない＝全納品先横断）
  - `DeliveryLocationSelector`: 既存 `SelectionModal` に上記 action ＋ 得意先列付きカラムを配線し、選択で `router.push('/delivery-location-selling-prices/{code}')`。未選択画面の初回選択と一覧での切り替え両方で使う
  - 未選択画面: 「納品先を選択してください」案内＋セレクタのみ（商品一覧は出さない）
  - ダッシュボードに「納品先別販売単価管理」カード（`/delivery-location-selling-prices`）を追加
  - 該当 E2E ケース（案内表示・モーダルのグローバル検索/得意先列/選択→遷移）の green を確認
- コミットメッセージ: `feat: 納品先別販売単価の納品先未選択画面とセレクタ・ダッシュボード入口`

### Step 4: 納品先別一覧画面（green・後半）
- 対象ファイル:
  - `src/app/(features)/delivery-location-selling-prices/[deliveryLocationCd]/page.tsx`（新規・Server Component）
  - `src/app/(features)/delivery-location-selling-prices/[deliveryLocationCd]/_components/DeliveryLocationSellingPriceTable.tsx`（新規・"use client" wrapper）
  - `src/app/(features)/delivery-location-selling-prices/[deliveryLocationCd]/_components/columns.tsx`（新規・`createColumns(deliveryLocationCode)`）
- 作業内容:
  - `deliveryLocationSellingPriceListQueryFactory().find({ deliveryLocationCode, referenceDate, code?, name?, priceStatus? })` を直呼び。封筒 `null` は `notFound()`
  - ヘッダ: 納品先名（`deliveryLocationName`）・コード、親得意先名・コード、無効なら「無効」バッジ、切り替え用 `DeliveryLocationSelector`
  - カラム: 商品コード（`<Link href=/delivery-location-selling-prices/[deliveryLocationCd]/[productCd]>`）｜商品名（無効バッジ）｜納品先別単価（active=金額／lapsed=失効中バッジ／none=上書きなしバッジ）｜適用期間（`formatPeriod`）｜共通単価（`formatYenFromDecimal`）
  - 検索フォーム（共有 `SearchForm`・商品コード／商品名／単価状態3択）。検索条件はクエリパラメータ→BE 絞り込み（FE 全件絞り込みをしない #473）
  - `validatePriceStatusFilter` 相当で select 値を `active|lapsed|none|undefined` に正規化
  - 残りの E2E ケースの green を確認
- コミットメッセージ: `feat: 納品先別販売単価の一覧画面（商品×現在単価・共通単価並記）`

### Step 5: リファクタと全体確認
- 対象ファイル: Step 3・4 の成果物
- 作業内容:
  - 得意先別 #508 との重複が「意味のある単位」で括れる場合のみ共有化を検討（字面一致だけの早すぎる抽象化はしない。多くは同型でも identity 語彙が異なるため個別実装が妥当）
  - `pnpm lint` / 変更に関係する E2E スペック（`delivery-location-selling-prices-list.e2e.ts`）の green を確認（全体 E2E は CI に任せる）
  - 計画からの逸脱があれば `docs/claude-plans/issue-548/deviations.md` に記録
- コミットメッセージ: （リファクタ内容に応じて `refactor:`。変更なしならコミットなし）

## 検証

- `pnpm e2e:seed` でフィクスチャ投入 → `pnpm exec playwright test delivery-location-selling-prices-list` で本スペックのみ green を確認（全体は CI）
- 手動確認: `/delivery-location-selling-prices` で案内＋セレクタ → モーダルでグローバル検索（得意先列で曖昧性解消）→ 選択で `/delivery-location-selling-prices/{code}` 遷移 → ヘッダの親得意先文脈・3状態バッジ・共通単価並記・適用期間・商品コードリンク宛先を目視
- `pnpm lint` green

## 補足
- 納品先 `code` のグローバル一意性は読みモデルが前提としている。Step 1 のシードで採番する DL コードは既存と衝突しない専用帯にする。
