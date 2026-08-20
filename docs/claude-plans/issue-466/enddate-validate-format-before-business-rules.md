# Issue #466: 適用終了の不正日付が誤ったメッセージで弾かれる問題の修正 — 実装計画

## 概要

2回目レビュー指摘 #1 への対応。`CommonSellingPrice.endDatePeriod()` は `endDate` を ISO 日付として
形式検証する前に文字列比較（`endDate <= referenceDate` / `endDate >= row.period.end`）しているため、
不正値が「原因と無関係なメッセージ」で弾かれる。

- `"9999-99-99"`（有界行に対して）→ 既存 end より大きいので「適用終了は短縮のみ可能です（延長できません）」
- `""`（空文字）→ 「今日より後である必要があります」

データ破損ではなく UX 上の問題（誤誘導メッセージ）。形式検証を業務ルール比較より前に前倒しして、
不正値は形式エラー（`ValidationError`）で正しく弾く。

`ApplicablePeriod.create` は終端で生成済み（現 `CommonSellingPrice.ts:121`）なので、これを比較より前へ
移すだけで形式検証が前倒しされ、生成済みの `ended` を `assertNoOverlap` でそのまま再利用できる
（二重生成も解消する純粋な改善）。

## 設計判断

### 形式検証の前倒し方法
- A. `ended = ApplicablePeriod.create({ start: row.period.start, end: endDate })` の生成を業務ルール比較
  より前へ移し、ISO 形式検証（`ApplicablePeriod` 内の `assertIsoDate`）を前倒しする。生成済みの `ended`
  を後段の `assertNoOverlap` で再利用する。
- B. `endDatePeriod` 内に日付形式チェックを別途追記する。
- 推奨: A（既存の `ApplicablePeriod` の検証を流用でき、二重生成も解消。新規ガードを足さない最小変更）

### チェックの順序
- `requireRow` → `contains(referenceDate)`（現在有効行のみ）→ **`ApplicablePeriod.create`（形式検証）** →
  `endDate <= referenceDate` → `endDate >= row.period.end`（短縮のみ）→ `assertNoOverlap(ended, row)` →
  `row.endDateOn(endDate)`
- 理由: 行の状態（現在有効か）は `endDate` 形式と独立なので先に判定。形式検証は業務ルール比較の直前に
  置き、不正値が業務ルールのメッセージへ漏れないようにする。

### エラー型
- 形式不正は `ApplicablePeriod.create` が投げる `ValidationError`（`@server/shared/errors/DomainError`）に
  なる。既存の業務ルール違反 `BusinessRuleViolationError` とは別型。テストは `ValidationError` を期待する。

## ステップ

### Step 1: RED — 不正な endDate が形式エラーになるテストを追加
- 対象ファイル: `src/server/subdomains/pricing/domain/entities/__tests__/CommonSellingPrice.test.ts`
- 作業内容:
  - `ValidationError`（`@server/shared/errors/DomainError`）を import に追加
  - `endDatePeriod` の describe 配下に、現在有効・有界行（例 `[today, 2025-07-01)`）に対し
    - `endDate = "9999-99-99"` を渡すと `ValidationError`（現状は「短縮のみ」メッセージで誤誘導）
    - `endDate = ""` を渡すと `ValidationError`（現状は「今日より後」メッセージで誤誘導）
  - 実装前は現状の `BusinessRuleViolationError` が飛ぶため RED になることを確認
- コミットメッセージ: `test: 適用終了の不正日付が形式エラーで弾かれることを期待するテストを追加 (#466)`

### Step 2: GREEN — endDatePeriod で形式検証を業務ルール比較より前へ前倒し
- 対象ファイル: `src/server/subdomains/pricing/domain/entities/CommonSellingPrice.ts`
- 作業内容:
  - `endDatePeriod` 内で `const ended = ApplicablePeriod.create({ start: row.period.start, end: endDate });`
    を `contains` チェック直後（`endDate <= referenceDate` 比較より前）へ移動
  - 終端にあった同一生成を削除し、`assertNoOverlap(ended, row)` は移動後の `ended` を参照
  - JSDoc の検証順序の記述を必要に応じて更新
  - テストが GREEN になることを確認
- コミットメッセージ: `fix: 適用終了で日付形式検証を業務ルール比較より前に前倒し誤メッセージを解消 (#466)`
