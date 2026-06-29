# Issue #466: 共通売単価のCRUD書き込みユースケースと編集/一覧読みモデル（#429のBE基盤） — 実装計画

## 概要

`CommonSellingPrice` 集約に保守系のドメイン操作（登録・編集・適用終了・削除）を追加し、pricing サブドメイン初の `application/commands` を立て、保守画面（#429）が必要とする編集/一覧の読みモデル（version付きDTO）を整える。価格決定（read）とは別の write/保守関心。

設計の芯は「**過去（既発行見積が時点解決した単価）を書き換えない**」。行の時点状態（将来/現在有効/失効）で編集・削除の権限を分け、集約の不変条件として強制する。設計判断は **ADR-20260627-86b**（時点ガード設計）に正本として記録済み。

## 設計判断

会話（grill）で確定済み。詳細・理由は ADR-20260627-86b 参照。

### 行の時点状態による編集・削除の権限（集約の不変条件）
| 行の状態 | 編集 | 削除 |
|---|---|---|
| 将来（今日 < 開始） | 全項目可 | 可 |
| 現在有効（開始 ≤ 今日 < 終了） | 終了日設定（適用終了）のみ可 | 不可 |
| 失効（今日 ≥ 終了） | 不可 | 不可 |
- 置き場: **集約の不変条件**として強制（command 側だけにしない）。`reconstruct` は再検証しない（移行の過去データ投入路を残す）。

### 参照日（「今日」）の供給
- **保存実行時にサーバー生成**（`toJstCalendarDay(new Date())`）、フォーム往復なし、各ドメインメソッドの最後の引数で注入（ADR-0030）。
- version（画面表示時をフォーム往復）とは逆方向。`new Date()` は Server Action 一箇所に隔離し、command/集約テストは固定文字列で決定的に。

### 新規登録の時点制約
- `addPeriod` は **開始日 ≥ 今日** を強制（過去にさかのぼった行の後付け登録を禁止）＋既存の重複禁止。

### 適用終了のドメイン表現
- **独立メソッド `endDatePeriod` / 独立コマンド**（ADR-0018流。入力 `{periodId, endDate}` の最小化・状態ガードの型表現）。UI上は編集フォーム内の終了日設定として提示してよいが実装は専用コマンド。

### Command結果型・楽観ロック競合
- 全コマンド **判別共用体なし・全失敗 throw**（重複・過去開始・状態違反＝`BusinessRuleViolationError`、VO検証＝`ValidationError`、競合＝`ConflictError`）。戻り値は集約を返すだけ（ADR-0038/0039）。

### 読みモデル
- **一覧**: 母集合=全商品。QueryService の SQL で算出（商品 LEFT JOIN 期間 `daterange @> 参照日::date`）。現在有効単価は **値/null の2値**（未設定内訳は持たない）。参照日はアプリ層が注入（`CURRENT_DATE` 不使用）。
- **編集**: QueryService 経由。親（集約ルート）に version 1つ、期間行配列、各行に `status`（将来/現在有効/失効）を read 側算出。Decimal は文字列で運ぶ。

### 棚上げ（このissueでは実装しない）
- 最低1期間前提のハード強制（価格決定側の安全弁＋未設定可視化に委譲・use-cases.md 7章）。

## ステップ

### Step 1: 集約のドメイン操作追加（編集・適用終了・削除）＋ addPeriod の参照日対応
- 対象ファイル: `src/server/subdomains/pricing/domain/entities/CommonSellingPrice.ts`, `CommonSellingPricePeriod.ts`, `domain/entities/__tests__/CommonSellingPrice.test.ts`
- 作業内容:
  - `addPeriod(period, price, referenceDate)` に参照日を追加し「開始日 ≥ 今日」を不変条件として強制
  - `editPeriod(periodId, changes, referenceDate)`（将来行のみ・全項目）、`endDatePeriod(periodId, endDate, referenceDate)`（現在有効行のみ・終了日のみ）、`deletePeriod(periodId, referenceDate)`（未来開始行のみ）を追加
  - 行の時点状態判定（`ApplicablePeriod.contains` 等）と状態別ガード。違反は `BusinessRuleViolationError`
  - 子エンティティに必要な変更（終了日設定・期間/単価差し替えの内部API。集約ルート経由限定・ADR-0027/0036）
  - 状態別（将来/現在有効/失効）の編集・削除可否の境界テスト
- コミットメッセージ: `feat: 共通売単価集約に編集・適用終了・削除のドメイン操作を追加（時点ガードを不変条件化）`

### Step 2: Repository の update 実装（差分upsert＋楽観ロック）
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository.ts`, `sellingPricePeriodPersistence.ts`, `infrastructure/prisma/__tests__/PrismaCommonSellingPriceRepository.test.ts`
- 作業内容:
  - `update(aggregate, expectedVersion)` を実装（期間行の差分 upsert・ADR-0032、親 version 条件付き `updateMany`・count=0 で `ConflictError`・ADR-0039）
  - 実DBの逐次再現で stale トークンの競合テスト
- コミットメッセージ: `feat: 共通売単価Repositoryのupdate実装（差分upsert＋親version楽観ロック）`

### Step 3: Application commands（登録・編集・適用終了・削除）
- 対象ファイル: `src/server/subdomains/pricing/application/commands/`（登録/編集/適用終了/削除の4コマンド）＋ `commands/__tests__/`
- 作業内容:
  - 4コマンドを新設（pricing 初の `commands/`）。input に `expectedVersion`、参照日は input で受け（Server Action がサーバー生成して詰める）ドメインへ素通し
  - findById→NotFound 弾き→ドメイン操作→`update(expectedVersion)`。全失敗 throw、戻り値は集約
  - command 単体テスト（参照日・expectedVersion の素通し、状態違反の throw）
- コミットメッセージ: `feat: 共通売単価の登録・編集・適用終了・削除コマンドを追加`

### Step 4: 一覧読みモデル（QueryService）
- 対象ファイル: `application/queries/`（一覧 QueryService interface＋DTO）, `infrastructure/queries/`（Prisma 実装）, それぞれの `__tests__`
- 作業内容:
  - 全商品母集合・現在有効単価（値/null 2値）・未設定可視化。商品 LEFT JOIN 期間 `@> $参照日::date`、参照日はアプリ注入
  - infra 実装テスト（現在有効/未設定/失効のみ等のケース）
- コミットメッセージ: `feat: 共通売単価の一覧読みモデル（商品単位・現在有効単価・未設定可視化）を追加`

### Step 5: 編集読みモデル（version付きDTO・行status）
- 対象ファイル: `application/queries/`（編集 QueryService interface＋DTO）, `infrastructure/queries/`（Prisma 実装）, それぞれの `__tests__`
- 作業内容:
  - 親に version、期間行配列、各行 `status`（将来/現在有効/失効）を read 側算出（参照日アプリ注入）。Decimal は文字列
  - infra 実装テスト
- コミットメッセージ: `feat: 共通売単価の編集読みモデル（version付きDTO・行の時点状態）を追加`
