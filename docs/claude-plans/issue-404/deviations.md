# Issue #404 実装の計画逸脱記録

## 逸脱1: Step 2 と Step 3 のコミット分割を統合した

### 元の計画
- Step 2「3イベントVOを OccurredAt で話すよう改修」と Step 3「呼び出し側（Mapper / EstimateApplication）の追従」を、それぞれ別コミットとする（計画ファイルの「ステップ」節は各 Step に独立したコミットメッセージ案を付与していた）。

### 実際の実装
- Step 2 と Step 3 の変更を 1 コミット（`refactor: 発生日時を OccurredAt 不変VO へ移行し raw Date を締め出す`）に統合した。Step 1（`OccurredAt` VO 新規追加）は計画どおり独立コミット。

### 逸脱の理由
- 本リポジトリの pre-commit フック（husky + lint-staged）は、ステージ済みファイルの lint に加えて **全テストスイート**を実行する。
- Step 2 はイベントVOの `create` 引数・getter の型を `Date` → `OccurredAt` に変える破壊的変更で、呼び出し側（`EstimateApplication`・Mapper・`EstimateApprovalStep.test.ts` 等）が raw Date を渡したままだと型・実行時エラーになる。
- そのため Step 2 を単独でコミットしようとすると、pre-commit の全テスト実行で呼び出し側テストが赤になり（`this._occurredAt.equals is not a function` 他）、コミットが弾かれた（実際に 1 度失敗）。
- 「意味的まとまりで分割」という計画の意図より、フックが要求する「リポジトリ全体の整合性（全テスト緑）」を優先し、Step 2 + Step 3 を不可分の 1 コミットに統合した。

## 逸脱2: Repository テストのアサーション型を Date から OccurredAt へ変更

### 元の計画
- 「Repository テストの `occurredAt` を `toBeInstanceOf(Date)` から `OccurredAt` ベースの検証へ追従（必要に応じ `.toDate()` を噛ませる）」。

### 実際の実装
- `.toDate()` は噛ませず、`expect(...).toBeInstanceOf(OccurredAt)` に置換した（3 箇所）。

### 逸脱の理由
- 当該アサーションの振る舞い上の意図は「往復後に発生日時が DB の created_at から復元される（ADR-0058）」ことの確認であり、復元された値が `OccurredAt` インスタンスであることを直接検証するのが最も意図に忠実。`.toDate()` を経由して `Date` を検証するのは中間表現への迂回で冗長と判断した。
