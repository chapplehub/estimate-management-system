# Issue #428: 価格決定ポリシーとアプリケーション解決の実装 — 実装計画

## 概要

販売単価マスタ3層の時点解決 QueryService（共通 #448 / 上書き2層 #459）を消費し、見積年月日・提出区分（宛先）で見積単価を一意に解決する **Domain Policy（純）＋ Application オーケストレーション**を実装する。pricing サブドメイン内で閉じる解決ロジックまでが範囲で、QueryService/DTO の新規実装・見積集約への配線（#430/#431/#432）・edit 用 version DTO（#429）は含まない。

実装は `/tdd`（red-green-refactor の **vertical slice**＝1テスト→1実装の tracer bullet）で進める。横スライス（全テスト先書き→全実装）はしない。

**新規作成物**
- `shared/domain/values/toJstCalendarDay.ts`（純関数）
- `pricing/domain/policies/PriceResolutionPolicy.ts`（純 Policy）
- `pricing/application/queries/ResolveSellingPriceQuery.ts`（オーケストレーション）
- 各 `__tests__`
- `pricing/application/factories/pricingQueryFactory.ts` に composite factory を追記

## 設計判断

`/grill-with-docs` で全9論点を確定済み。各判断の選択肢と決定は以下（典拠付き）。

### 1. 責務分割：純 Policy ＋ オーケストレーションの分離
- A. 純 `PriceResolutionPolicy`（判断）＋ `ResolveSellingPriceQuery`（段取り）を独立 / B. 単一アプリ関数に畳む
- **決定: A**。`LineItemAmountPolicy` 等の「薄いが名前付き規則」前例・ADR-0023 に沿う。税率の `TaxRateConsistencyCheckDomainService`（判断）/`checkTaxRateThenSave`（段取り）と同じ対構造。

### 2. 解決不能（上書きも共通も無い）の throw 場所
- A. Policy 自身が throw（戻り型は常に `SellingUnitPrice`）/ B. Policy は不在を返しアプリ層で throw
- **決定: A**。完全相似の税率が `BusinessRuleViolationError` をドメイン層で throw。ADR-0038「失敗は throw／判別共用体は複数の正常な結末に限定」。解決不能は不変条件違反（共通販売単価は有効商品の必須前提）で正常な結末ではない。

### 3. エラー型
- A. `BusinessRuleViolationError` 直接 / B. 専用サブクラス `PriceUnresolvableError`
- **決定: A**。当リポジトリは `BusinessRuleViolationError` のサブクラスを1つも持たず（89箇所すべて基底直接・`DomainError` 直下3クラスのフラット階層）、消費側も共有 `error-handler.ts` が `instanceof` で一律処理。型分岐の需要ゼロ＝サブクラスは利得なし（YAGNI）。メッセージに productId・提出区分を含める。

### 4. Policy の入力データ構造
- **決定**: `resolve({ override: SellingUnitPrice | null, common: SellingUnitPrice | null, productId: string, addressee: "CUSTOMER" | "DELIVERY_LOCATION" }): SellingUnitPrice`。
- DTO→VO 変換（`SellingUnitPrice.fromMoney(Money.fromDecimalString(dto.sellingPrice))`）は**アプリ層**で行う。ドメイン Policy はアプリ層型 `SellingPriceResolutionDTO` を import 不可（CLAUDE.md レイヤリング規則1）。
- productId・addressee は論点8（contextful メッセージ）のために受ける。どちらもプリミティブ／pricing 独自型でレイヤリング違反なし。

### 5. オーケストレーション入口の型
- A. pricing 独自タグ付き共用体（プリミティブ ID）/ B. estimate の `SubmissionType` 再利用 / C. shared 昇格
- **決定: A**（→ **ADR-20260626-p3w**）。pricing→estimate 逆依存を避け、QueryService の素 ID 境界規約と一貫。タグ付き共用体で「納品先宛なのに customerId」を型排除（ADR-20260624-8tg と相補）。消費側（#430）が `SubmissionType`＋宛先 ID をこの型へマップ。

### 6. Date→JST暦日変換の置き場
- A. 入口は `estimateDate: Date`、変換は #428 内部 / B. 消費側が変換済み string を渡す
- **決定: A**（ADR-20260624-95f「変換は価格決定の責務／1箇所の純関数」）。`shared` に新規純関数 `toJstCalendarDay(date: Date): string`（`FiscalYear` と同じ +9h→getUTC* の環境 TZ 非依存技法・ADR-0024）を置き、オーケストレーションが一度だけ変換して両 QueryService に同じ暦日文字列を渡す。

### 7. 「同一キー高々1件」の保証場所
- **決定: #428 はアサーション無し**。EXCLUDE 制約（DB 物理保証）＋ドメイン `overlaps` ガード（#426）＋時点解決 QueryService の単一行契約（`DTO | null`）で上流保証済み。追加チェックは QueryService チームが拒否した「到達不能・テスト不能な死にコード」になるため置かない。

### 8. contextful メッセージのデータ源
- **決定**: Policy が productId・提出区分を受け取りメッセージを組む（論点4を拡張）。論点2（Policy throw）＋論点3（contextful）を両立させるための最小の拡張。

### 9. テスト戦略
- **Policy**: 純・DB 非依存ユニット。先勝ち／フォールバック／解決不能の**組合せ網羅をここが全部持つ**（単一の真実源）。
- **オーケストレーション**: DB-backed 結合テスト（既存 `Resolve*Query` 慣習）。**配線のみ**を少数 seed で（ルーティング・JST 境界・エラー貫通）。per-layer SQL は #448/#459 の infra テストが担保済みゆえ再テストしない。クロス参照禁止は論点5の型保証ゆえテスト不要。

## ステップ

> 各ステップは vertical slice（1テスト→1実装→次）。RED→GREEN を behavior 単位で回し、ステップ末で意味のあるまとまりとしてコミットする。

### Step 1: `toJstCalendarDay`（shared・純関数）
- 対象ファイル: `src/server/shared/domain/values/toJstCalendarDay.ts` ＋ `__tests__/toJstCalendarDay.test.ts`
- 作業内容（tracer bullet 順）:
  - RED→GREEN: `2026-06-24T15:00:00Z`（＝JST 2026-06-25）→ `"2026-06-25"`（off-by-one 境界）
  - RED→GREEN: JST 0:00 ちょうど・月末跨ぎ
  - 環境 TZ 非依存（`FiscalYear` と同じ +9h→getUTC*）で実装
- コミットメッセージ: `feat: Date→JST暦日変換の純関数 toJstCalendarDay を追加`

### Step 2: `PriceResolutionPolicy`（pricing/domain・純 Policy）
- 対象ファイル: `src/server/subdomains/pricing/domain/policies/PriceResolutionPolicy.ts` ＋ `__tests__/PriceResolutionPolicy.test.ts`
- 作業内容（tracer bullet 順）:
  - RED→GREEN: override あり（common もあり）→ override 採用（common 無視）
  - RED→GREEN: override null・common あり → common 採用
  - RED→GREEN: 両方 null → `BusinessRuleViolationError`、メッセージに productId・提出区分（addressee 2値とも）
- コミットメッセージ: `feat: 価格決定ポリシー PriceResolutionPolicy を追加（2段解決・解決不能throw）`
  - ボディに設計判断を記載（解決不能を Policy 自身が throw／BusinessRuleViolationError 直接／contextful メッセージのため productId・提出区分を受ける）

### Step 3: `ResolveSellingPriceQuery`（pricing/application・オーケストレーション）
- 対象ファイル: `src/server/subdomains/pricing/application/queries/ResolveSellingPriceQuery.ts` ＋ `__tests__/ResolveSellingPriceQuery.test.ts`（DB-backed・既存 `ResolveCommonSellingPriceQuery.test.ts` の seed パターン踏襲）
- 作業内容（tracer bullet 順）:
  - 入口型 `SellingPriceResolutionTarget`（タグ付き共用体）を定義
  - RED→GREEN: 得意先宛 → 得意先別 override 採用（得意先別＋共通を seed）
  - RED→GREEN: 得意先宛・得意先別なし → 共通へフォールバック
  - RED→GREEN: 納品先宛 → 納品先別ルーティング
  - RED→GREEN: 全層該当なし → `BusinessRuleViolationError` 貫通
  - RED→GREEN: JST 境界（`estimateDate = 2026-06-24T15:00:00Z` で 6/25 始まり期間に解決）
  - 内部: ① `toJstCalendarDay` 変換 → ② addressee 分岐で上書き＋共通 QueryService 呼び出し → ③ DTO→VO → ④ Policy 適用
- コミットメッセージ: `feat: 2段解決オーケストレーション ResolveSellingPriceQuery を追加`
  - ボディに設計判断を記載（入口は pricing 独自タグ付き共用体＝ADR-20260626-p3w／Date→JST 変換をここで1回＝ADR-20260624-95f）

### Step 4: factory 配線
- 対象ファイル: `src/server/subdomains/pricing/application/factories/pricingQueryFactory.ts`
- 作業内容:
  - `resolveSellingPriceQueryFactory()` を追記（3 Prisma QueryService を注入して composite を構築）
- コミットメッセージ: `feat: ResolveSellingPriceQuery の factory を追加`

### Step 5: 仕上げ
- `pnpm test` / `pnpm lint` グリーン確認
- 計画と異なる対応をした場合は `docs/claude-plans/issue-428/deviations.md` に記録（CLAUDE.md ルール）

## スコープ外（後続 issue）
- 見積明細生成への配線・単価固定化（手入力委譲鎖の撤去含む）→ #430
- 再解決契機（明細追加／複製先生成／改訂先生成／見積年月日・宛先変更）→ #431
- 一斉再解決前のユーザ確認 UI → #432
- 編集用 QueryService/DTO（version 読出経路）→ #429
