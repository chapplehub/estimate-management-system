# Issue #403: refactor: Money に金額の大小比較API（isAtLeast / compareTo）を追加する — 実装計画

## Context

共有VO `Money`（ADR-0022・整数最小単位 + Currency）には大小比較メソッドが無く、`ApprovalRequirementPolicy.isAtLeastYen` が `!amount.subtract(threshold).isNegative()` という回避イディオムで「閾値以上か」を表現している（コメントにも「Money に大小比較がないため」と明記）。この負債は PR #401 のコードレビュー（指摘#10）で発見され、`Money` が他集約からも使われる共有VOのため #401 の範囲外として本 issue に分離された。

本計画は `Money` に大小比較APIを追加し、回避イディオムを置き換えて負債を解消する。

### 横断調査の結果（回避イディオムの実体）

`.subtract(...).isNegative()` 形は4箇所あるが、**真の「比較回避」は1箇所のみ**:

| 箇所 | 内容 | 判定 |
|------|------|------|
| `ApprovalRequirementPolicy.isAtLeastYen` (4回呼出) | 差額を捨て真偽だけ取り出す | **置換対象** |
| `EstimateAmountPolicy:54-56` | 差額 `afterOverallDiscount` を後続で使用 | 正当な計算（対象外） |
| `LineItemAmountPolicy:44-46` | 差額 `finalAmount` を後続で使用 | 正当な計算（対象外） |
| `GrossProfitPolicy:33-37` | 粗利の計算結果を使用 | 正当な計算（対象外） |

## 設計判断（ユーザー確定済み）

### 提供するAPIの形・最小セット
- **確定**: `compareTo(other): number`（-1/0/1）を基礎に、述語4種 `isGreaterThan`(>) / `isAtLeast`(>=) / `isLessThan`(<) / `isAtMost`(<=) を派生提供する
- 理由: 読み手は意図が明示的な述語を、ソート等は `compareTo` を使える。境界（`>` と `>=`）の双方を網羅し、呼び出し側ごとの境界解釈のブレを防ぐ
- `isAtLeast` の命名は `ApprovalGoalTier.isAtLeast` / `PositionTier.isAtLeast` で確立済みの規約に揃う

### 異通貨時の挙動
- **確定**: 例外（`InvalidArgumentError`）を投げる。ADR-0022「異種通貨の演算・比較を実行時に禁止」に完全準拠
- メッセージは比較専用に『異なる通貨同士は比較できません（{A} と {B}）』とする（既存 `assertSameCurrency` の『演算できません』とは文言を分ける）

### isAtLeastYen ヘルパーの扱い
- **確定**: `private static isAtLeastYen` を削除し、呼び出し4箇所を `finalTotal.isAtLeast(Money.fromMajorUnits(...))` に直接展開する
- 理由: 「比較回避を隠す」ヘルパーの存在理由が消えるため、ヘルパーごと撤去してドメインオブジェクト同士の素直な比較にする

### ゼロ比較・符号判定（既存APIとの役割分担）
- 既存 `isNegative()` / `isZero()` は変更しない（引数なしの符号判定として役割が独立）。新APIはいずれも `Money` 引数を取る大小比較。役割は重複しない

## ステップ

### Step 1: Money に比較API（compareTo + 述語4種）を追加
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/Money.ts`
  - `src/server/subdomains/estimate/domain/values/__tests__/Money.test.ts`
- 作業内容:
  - `compareTo(other: Money): number` を追加。異通貨は比較専用メッセージで例外。`this._minorUnits` と `other._minorUnits` を比較し `Math.sign` 相当で -1/0/1 を返す
  - `isGreaterThan` / `isAtLeast` / `isLessThan` / `isAtMost` を `compareTo` ベースで実装（境界の真理値を一元化）
  - 既存の `equals`/`subtract` 群の近くに配置し、JSDoc で各境界（`>` / `>=` / `<` / `<=`）を明示
  - テスト追加: 正常系（大小・等値・各境界）、異常系（異通貨で `InvalidArgumentError` が比較専用メッセージで送出）。既存の `describe("正常系")` / `describe("異常系")` 構成に従う
- コミットメッセージ: `feat: Money に大小比較API（compareTo / isAtLeast ほか）を追加`
  - ボディに「異通貨は例外（ADR-0022 準拠）／述語は compareTo へ集約」の設計理由を記載

### Step 2: ApprovalRequirementPolicy の回避イディオムを新APIで置換
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/policies/ApprovalRequirementPolicy.ts`
  - `src/server/subdomains/estimate/domain/policies/__tests__/ApprovalRequirementPolicy.test.ts`（既存挙動の回帰確認。テスト変更は原則不要だが実行して緑を確認）
- 作業内容:
  - `private static isAtLeastYen` を削除
  - `judge` 内の `!isAtLeastYen(input.finalTotal, 100_000)` を `!input.finalTotal.isAtLeast(Money.fromMajorUnits(100_000))` に展開
  - `goalTierOf` 内の3箇所（30_000_000 / 10_000_000 / 1_000_000）も同様に `finalTotal.isAtLeast(Money.fromMajorUnits(...))` へ展開
  - 「Money に大小比較がないため…」の旧コメントを削除
- コミットメッセージ: `refactor: ApprovalRequirementPolicy の閾値比較を Money.isAtLeast に置換 (#403)`

## 検証

- `pnpm test src/server/subdomains/estimate/domain/values/__tests__/Money.test.ts` — 新比較APIの正常系・異常系が緑
- `pnpm test src/server/subdomains/estimate/domain/policies/__tests__/ApprovalRequirementPolicy.test.ts` — 置換後も既存の承認要否判定（10万未満免除・各ゴール段階）が緑（リファクタの振る舞い不変を保証）
- `pnpm lint` / `pnpm build` — 型・lint が通る
- 横断確認: `grep -rn "isAtLeastYen" src` で参照が0件になること

## 補足

- DDDレイヤリング: 変更はドメイン層内のみ。外部ライブラリ依存の追加なし（ADR-0022 の純粋TypeScript方針を維持）
- ADR起票の要否はユーザー判断（本計画では新規ADRは作成しない。既存方針の範囲内の追加のため）
