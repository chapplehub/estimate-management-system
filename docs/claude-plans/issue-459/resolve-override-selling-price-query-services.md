# Issue #459: 得意先別・納品先別販売単価の時点解決QueryService（価格決定B / 上書き2層版） — 実装計画

## 概要

#448（共通販売単価の時点解決 QueryService・価格決定フェーズ B）の対称スライスとして、上書き2層（得意先別・納品先別）の read 側を実装する。「ある得意先×商品（または納品先×商品）・ある見積年月日で適用される売単価はいくらか」を、集約ロードを介さず `applicable_period @> $date::date` で特定時点の1単価として引く QueryService を提供する（ADR-0066 の read 関心分離）。

後続 #428（価格決定ポリシーとアプリケーション解決）が、本 issue の2層 QueryService と #448 の共通層 QueryService を提出区分で選び分けて消費する。本 issue は #428 の依存。

成果物は「層ごとに単価か null を返す read 入口」までに閉じ、提出区分の選び分け・共通へのフォールバック・解決不能時の操作拒否は #428 に残す。

## 設計判断

### QueryService を層ごとに分けるか、判別子つき1本に統合するか
- A. 層ごとに2本（`CustomerSellingPriceQueryService` / `DeliveryLocationSellingPriceQueryService`）
- B. 判別子つき1本に統合
- **採用: A**。ADR-8tg が書き込み側を「判別子なしの独立同型集約・クロス参照はコンパイルエラー」と決めた以上、read 側だけ判別子で1本化すると #428 の「得意先宛なのに納品先別を引く」誤りを型で防げなくなる。入力キーも 得意先id+商品id / 納品先id+商品id で構造が異なる。#448 の層名を冠した命名・DTO・factory とも対称。

### read の SQL を共有ヘルパに抽出するか
- A. 各 Prisma 実装にインライン `$queryRaw`（#448 と対称）
- B. write 側 `sellingPricePeriodPersistence.ts` のように共有ヘルパへ抽出
- **採用: A（共有しない）**。write 側ヘルパの抽出が正当だったのは半開区間 `[)` のリテラル生成という「間違えやすい部分」を隔離できたから。read 側は既存列に `@>` を当てるだけで危険な区間生成が無く、半開の正しさは schema の `daterange` + EXCLUDE に single-source 済み。rule-of-three は満たすが、抽出は新構造（ヘルパ）＋新判断点（キー渡しの parallel-arrays / discriminated union）を生み、層判別子を infra に再集権化する。便益（消えるドリフト危険）がほぼ0でコストが高いため畳まない。
  - 参考 learning: `learning/duplication-vs-coupling-four-liabilities.md`, `learning/consolidation-cost-does-it-spawn-structure.md`

### 解決結果 DTO を3層で共有するか、層ごとに分けるか
- A. 層名・キーを含まない共有 `SellingPriceResolutionDTO`（`{ sellingPrice: string }`）に統合し、#448 の `CommonSellingPriceResolutionDTO` も移行
- B. 層ごとに別 DTO
- **採用: A（共有）**。DTO は identity（キー）も分岐軸も持たない単一フィールドの値の形で、集約を分けた根拠（層ごとに異なる複合自然キー）が DTO には存在しない。畳んでも新構造を生まず（型名が1つ減るだけ）、#428 の `override ?? common` フォールバックが単一型で書ける。畳むコストが0なので、わずかな整いのために統合してよい。

### 成果物境界（2段フォールバックの置き場）
- 本 issue: 各層 QueryService（単価 or null）＋ 薄い委譲ラッパ ＋ factory 結線 ＋ テストまで
- #428: 提出区分の選び分け・`override ?? common` の2段解決・両方 null の操作拒否
- **理由**: CONTEXT.md「価格決定」が定義する機構そのものは #428 の領分。#448 の「エラー化は上位の責務」を対称に守る。

### Resolve ラッパを作るか、#428 が QueryService を直接握るか
- **採用: ラッパ2本を作る**。税率 `ResolveEffectiveTaxRateQuery`・#448 が確立した「application のユースケース入口＋factory 結線＋#428 が依存する安定 API／DI 継ぎ目」の役割と一貫させる。

### テストの範囲
- 半開境界マトリクス（開始含む／終了含まない／無期限上端）は `@>`/daterange の DB 保証として #448 で実証済み。**層ごとに再網羅しない**（同じ真実を3回テストする偶然の重複）。
- インライン SQL を共有しないため、**層ごとに違う真実（テーブル名・キー列）はキー隔離・層隔離テストで層ごとに押さえる**。

### 対称性で自明な確定（判断不要）
- 入力 `{ <keyId>, productId, date: string }`、Date→JST 暦日変換は呼び出し側（#428）責務（ADR-95f）
- null は「行が無い」と「覆う区間が無い」を区別しない（#448 と同じ）
- `selling_price::text` の10進文字列素通し（float64 を通さない）
- CONTEXT.md 更新不要（新しい正準語なし）／ADR 新規不要（既存 0066/0067/8tg/95f の対称延長）

## ステップ

### Step 1: 共有 DTO `SellingPriceResolutionDTO` の新設と #448 の移行
- 対象ファイル:
  - 新規 `src/server/subdomains/pricing/application/queries/dto/SellingPriceResolutionDTO.ts`
  - 移行 `CommonSellingPriceQueryService.ts` / `ResolveCommonSellingPriceQuery.ts` / `infrastructure/queries/PrismaCommonSellingPriceQueryService.ts` / 既存テストの import
  - 削除 `dto/CommonSellingPriceResolutionDTO.ts`
- 作業内容:
  - 層名・キーを含まない `{ sellingPrice: string }` を定義（doc コメントは #448 のものを一般化）
  - 共通層の3ファイル＋テストの参照を新 DTO に張り替え、旧 DTO を削除
- コミットメッセージ: `refactor: 販売単価の時点解決DTOを層非依存の共有SellingPriceResolutionDTOへ統合`

### Step 2: 得意先別 時点解決 QueryService（IF＋Prisma実装＋ラッパ＋factory）
- 対象ファイル:
  - `application/queries/CustomerSellingPriceQueryService.ts`（IF）
  - `infrastructure/queries/PrismaCustomerSellingPriceQueryService.ts`（インライン `$queryRaw`）
  - `application/queries/ResolveCustomerSellingPriceQuery.ts`（薄い委譲）
  - `application/factories/pricingQueryFactory.ts`（結線追加）
- 作業内容:
  - 入力 `{ customerId, productId, date }`、`WHERE customer_id = $::uuid AND product_id = $::uuid AND applicable_period @> $::date`、`selling_price::text`、`rows[0] ?? null`
- コミットメッセージ: `feat: 得意先別販売単価の時点解決QueryService（@>で時点直引き・価格決定B）`

### Step 3: 得意先別 テスト（infra＋ラッパ・実DB）
- 対象ファイル:
  - `infrastructure/queries/__tests__/PrismaCustomerSellingPriceQueryService.test.ts`
  - `application/queries/__tests__/ResolveCustomerSellingPriceQuery.test.ts`
- 作業内容:
  - infra: happy ／ キー隔離（別商品・別得意先 → null）／ 層隔離（同じ商品に共通販売単価があっても引かない → null）／ 該当なし → null
  - ラッパ: happy ／ null
  - セットアップは商品＋得意先を各リポジトリで作り `PrismaCustomerSellingPriceRepository` で集約登録
- コミットメッセージ: `test: 得意先別販売単価 時点解決のキー隔離・層隔離・null回帰テスト`

### Step 4: 納品先別 時点解決 QueryService（IF＋Prisma実装＋ラッパ＋factory）
- 対象ファイル: 得意先別と対称（`DeliveryLocation...`）。キーは `delivery_location_id, product_id`
- コミットメッセージ: `feat: 納品先別販売単価の時点解決QueryService（@>で時点直引き・価格決定B）`

### Step 5: 納品先別 テスト（infra＋ラッパ・実DB）
- 対象ファイル: 得意先別と対称
- 作業内容: セットアップだけ差分（納品先は得意先を親に持つので 商品＋得意先＋納品先 を用意）。キー隔離は 別商品・別納品先、層隔離は 共通の行を引かない
- コミットメッセージ: `test: 納品先別販売単価 時点解決のキー隔離・層隔離・null回帰テスト`
