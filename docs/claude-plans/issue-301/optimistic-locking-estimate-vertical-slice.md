# Issue #301: 横断的に楽観ロック（optimistic concurrency control）を導入する — 実装計画

## 概要

全 Update 系コマンドの lost update（並行更新による静かな変更喪失）を防ぐため、楽観ロックを横断導入する。

本イシューのスコープは **横断ポリシーの確立 + estimate 縦切りの参照実装**:

1. 集約ルート7テーブルへの `version Int @default(1)` 一括マイグレーション
2. `EstimateRepository` の `insert` / `update(estimate, expectedVersion)` 分割と条件付き UPDATE による競合チェック
3. C2 UpdateEstimate / C3 AddVariation / C4 UpdateVariation への version 引き回し（フォーム hidden input → Zod → コマンド Input → リポジトリ）
4. lost update 防止を実証するリポジトリ統合テスト
5. 横断ポリシーの ADR 化（**ADR-0039 起票済み・コミット 3f252c6**）

マスタ系6サブドメイン（customer / employee / product / delivery-location / role / department）と Delete 系への適用は後続イシューに分割する（イシュー受け入れ条件「全 Update 系コマンドへの統一適用」との差分はイシューコメントで明示する）。

設計判断の詳細・全選択肢・根拠は [ADR-0039](../../adr/0039-cross-cutting-optimistic-locking-via-aggregate-root-version.md) を正とする。

## 設計判断

グリリングセッション（2026-06-11）で合意済み。ADR-0039 に起票済みのため、ここでは結論のみ列挙する。

### 1. 楽観ロックトークンの実体
- A. `version Int @default(1)` 列を新設 / B. `updatedAt` 流用 / C. `xmin` 流用
- 採用: A（整数等値比較で失敗モードを型レベルで排除。B は規律依存の偽競合リスク、C は dump/restore での偽競合と raw query 侵食）

### 2. version 列を持たせる単位
- 集約ルート7テーブルのみ。子テーブルには持たせない（書き込みは必ずルート経由のため、ルートの version 1つで集約全体が守られる）

### 3. 期待 version の出所
- フォーム往復（編集画面表示時の version を hidden input で持ち回り）
- コマンド内 findById の version では編集ウィンドウ（lost update の本体）を守れないため

### 4. 期待 version の通り道
- リポジトリメソッドの引数で渡し、条件付き UPDATE 1箇所で原子的にチェック
- ドメインエンティティに version は載せない（永続化メタデータでありドメイン概念ではない。ADR-0030 の延長）

### 5. 対象コマンドの範囲
- 既存集約を変更する全コマンド（追加型 AddVariation・状態変更型 Activate/Deactivate 等も含む）。除外は新規作成のみ
- 差分 upsert（ADR-0032）の deleteMany が stale 集約からの保存で他人の子を消しうるため、追加型も対象

### 6. Delete 系
- ポリシー上は対象。実装は後続イシュー（優先度は更新系より下）

### 7. 競合の返し方
- 既存 `ConflictError` の throw（ADR-0038 基準で「表示して終わり」=失敗）。専用サブクラス・共用体は作らない
- メッセージは version 不一致と行消失の両方を覆う:「他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。」

### 8. 渡し忘れ防御
- `save` 廃止、`insert(aggregate)` / `update(aggregate, expectedVersion)` にメソッド分割（型で強制）
- 存在確認 `findUnique` プローブも廃止。Prisma 実装は `updateMany`（WHERE id AND version）+ `version: { increment: 1 }`、`count === 0` で throw

### 9. 段取り
- #301 = 7テーブル一括マイグレーション + estimate 縦切り + ADR。マスタ系6サブドメイン・Delete 系は後続イシュー
- リポジトリインターフェースはサブドメイン独立のため、estimate のみ分割しても型的に成立する

### 10. テスト戦略
- 実 DB リポジトリ統合テストで stale トークンを**逐次**再現（並行 Promise.all テストは flaky の割に証明力が増えないため主役にしない。ADR-0035 と同じ思想）
- コマンド単体テストは expectedVersion の素通しを検証。E2E は既存 CRUD のリグレッション確認のみ

## ステップ

### Step 1: スキーマ移行（7テーブル一括）
- 対象ファイル: `prisma/schema.prisma`、新規マイグレーション SQL
- 作業内容:
  - Estimate / Customer / Employee / Product / DeliveryLocation / Role / Department の7集約ルートに `version Int @default(1)` を追加
  - `pnpm db:migrate` でマイグレーション生成・適用、`pnpm db:generate`
  - シード・既存テストが通ることを確認（列は不活性なので影響なしの想定）
- コミットメッセージ: `feat: 集約ルート7テーブルに楽観ロック用version列を一括追加`

### Step 2: EstimateRepository インターフェース分割
- 対象ファイル: `src/server/subdomains/estimate/domain/repositories/EstimateRepository.ts`
- 作業内容:
  - `save(estimate)` を削除し `insert(estimate)` / `update(estimate, expectedVersion: number)` を宣言
  - JSDoc に競合時 `ConflictError` throw の契約を明記
- コミットメッセージ: `feat: EstimateRepositoryをinsert/updateに分割し楽観ロック契約を定義`
  - ボディに設計判断（save 廃止の理由 = expectedVersion 渡し忘れの型防止、ADR-0039 参照）を記載

### Step 3: PrismaEstimateRepository 実装と統合テスト
- 対象ファイル: `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository.ts`、`__tests__/PrismaEstimateRepository.test.ts`
- 作業内容:
  - 冒頭の存在確認 `findUnique` プローブを廃止し、`insert`（create のみ、P2002 翻訳は維持）と `update`（公開化した差分 upsert）に分割
  - `update` の `$transaction` 先頭でルート更新を `updateMany({ where: { id, version: expectedVersion }, data: { ...scalar, version: { increment: 1 } } })` に変更、`count === 0` で `ConflictError` を throw（決定7の文言）
  - 統合テスト: insert → update(v1) 成功 → update(v1) が `ConflictError`、先行変更が残存することを検証（受け入れ条件「lost update 防止の実証」）
- コミットメッセージ: `feat: PrismaEstimateRepositoryに条件付きUPDATEによる楽観ロックを実装`

### Step 4: アプリ層への version 引き回し
- 対象ファイル: `CreateEstimateCommand.ts`、`shared/checkTaxRateThenSave.ts`、`UpdateEstimateCommand.ts`、`AddVariationCommand.ts`、`UpdateVariationCommand.ts`、各テスト・ファクトリ
- 作業内容:
  - CreateEstimateCommand: `save` → `insert`
  - `checkTaxRateThenSave` に `expectedVersion` を追加し `update` を呼ぶ（利用元は更新系3コマンドのみ）
  - C2/C3/C4 の Input に `version: number` を追加し素通し
  - コマンド単体テスト: テストダブルを insert/update 化し、`input.version` がそのまま渡ることを検証
- コミットメッセージ: `feat: 見積更新系コマンドC2/C3/C4にexpectedVersionを引き回す`

### Step 5: クエリ側 DTO への version 追加
- 対象ファイル: 見積詳細・編集画面が使うクエリ／DTO（実装時に特定）
- 作業内容:
  - 編集・バリエーション追加/編集画面の表示データに `version` を含める
- コミットメッセージ: `feat: 見積詳細DTOにversionを追加`

### Step 6: プレゼンテーション層のフォーム往復
- 対象ファイル: 見積編集・バリエーション追加/編集のフォームコンポーネント、Zod スキーマ、Server Action
- 作業内容:
  - hidden input で version を埋め込み（バリエーション系は親見積の version）
  - Zod スキーマに `version: z.coerce.number().int()` を追加
  - Server Action からコマンド Input へ受け渡し
  - 競合時は既存 `handleCommandError()` 経路でメッセージ表示（追加実装なしを確認）
- コミットメッセージ: `feat: 見積編集系フォームにversion hidden inputを追加し楽観ロックを貫通させる`

### Step 7: E2E リグレッション確認と後続イシュー切り出し
- 対象ファイル: なし（確認作業 + GitHub）
- 作業内容:
  - `pnpm e2e` で既存 CRUD E2E が version 追加後も通ることを確認
  - `/create-issue` でマスタ系6サブドメイン各1件 + Delete 系適用1件の後続イシューを作成（ADR-0039 と #301 を関連付け）
  - #301 にスコープ分割の経緯をコメント（受け入れ条件との差分を明示）
- コミットメッセージ: （コード変更があれば）`test: 楽観ロック導入後のE2Eリグレッション修正`
