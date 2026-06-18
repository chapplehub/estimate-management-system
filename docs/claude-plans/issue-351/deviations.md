# Issue #351 実装計画からの逸脱記録

## 1. Step 2 に専用クエリ `ResolveEffectiveTaxRateQuery` を新設

- **元の計画**: Step 2 は「`TaxRateRepository.findEffectiveAt` で有効税率を返す薄い Server Action」。
- **実際の実装**: Server Action（`resolveEffectiveTaxRate`）はアプリ層クエリ `ResolveEffectiveTaxRateQuery` 経由で解決する形にした（test-first で単体テスト追加）。
- **理由**: presentation（Server Action）がドメインリポジトリを直接握るのを避け DDD レイヤリングを保つため。単一日付の解決は 2 日付比較の `TaxRateConsistencyCheckDomainService` とは別関心のため専用クエリが素直。

## 2. Step 5・6 を「コンパイル可能な意味単位」で3コミットに再分割

- **元の計画**: Step 5（作成フォーム本体）→ Step 6（アクション＋ルート＋リダイレクト）の2ステップ。
- **実際の実装**: 次の3コミットに再編した。
  1. `SubmissionTypeField` の共有抽出（リファクタ・挙動不変）
  2. `createEstimate` アクション＋`ESTIMATE_CREATED`（バックエンド配線・単独で tsc/lint 可能）
  3. `CreateEstimateForm` 本体＋`/estimates/new` ルート＋作成者クエリ
- **理由**: フォームはアクションに依存するため Step 5 単独ではコンパイルできず、壊れた中間コミットになる。CLAUDE.md「意味のあるまとまりでコミット」に従い、各コミットが tsc/lint を通る単位へ分割した。ステップの設計内容自体は不変。

## 3. 作成者氏名解決のため `getEmployeeByIdQueryFactory` を新設

- **元の計画**: 明示なし（作成者＝`session.user.employeeId`、表示名は「Employee を引いて『氏名（コード）』」とだけ記載）。
- **実際の実装**: employee サブドメインに `getEmployeeByIdQueryFactory`（既存 `GetEmployeeByIdQuery` の Composition Root）を追加し、`/estimates/new` の RSC で作成者 DTO を解決。
- **理由**: 作成者表示名の解決に既存クエリのファクトリが無かったため。計画の意図（氏名（コード）表示）の実現に必要な配線。
