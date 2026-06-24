# Issue #458: 販売単価3リポジトリの writePeriods/translateInsertConflict/update 複製を共通化 — 実装計画

## Context

販売単価3リポジトリ（Common / Customer / DeliveryLocation）の Prisma 実装で、`writePeriods`（append-only 同期）・`translateInsertConflict`（P2002→ConflictError 翻訳）・`update`（version 条件付き楽観ロック）の3メソッドがほぼ丸ごと複製されている（PR #455 のレビュー指摘）。

問題は2層ある。(1) append-only 同期や楽観ロックの不変条件に変更・修正が入ると3ファイルを手で同期させる必要があり、1箇所漏らすと層ごとに永続化挙動が食い違う（#429 で removePeriod を足す際も同様）。(2) ADR-20260624-8tg が複製範囲を「table 名違いだけ」（43行目）と過小評価しており、レビューで広範な複製コストが見落とされやすい。

本リファクタリングは infra 層内に閉じた**関数ヘルパへの抽出**で重複を解消し、ADR の根拠記述を実態に合わせて更新する。挙動は不変（純粋なリファクタ）で、N+1 INSERT 改善は構造だけ用意し別 Issue とする。

## 確定済みの方針（ユーザー確認済み）

- **共通化方式**: 関数ヘルパへ抽出（基底クラス・ジェネリッククラスは不採用。ADR-8tg/0043 の「明示的重複＞抽象化」方針と整合し、Prisma の型付きアクセサをリポジトリに残せる）。
- **スコープ**: `writePeriods` / `translateInsertConflict` / `update` の3メソッドに限定（`findBy*` はシグネチャ差が大きく対象外）。
- **N+1 INSERT 改善**: ヘルパを将来の複数行一括 INSERT に差し替えやすい形にするのみ。挙動変更は本 Issue では行わず別 Issue。
- **ADR**: ADR-20260624-8tg の「複製範囲」記述（43行目の根拠）を実態に追記修正。新規 ADR は起票しない。

## 設計判断

### 共通ヘルパの配置層
- A. `src/server/subdomains/pricing/infrastructure/prisma/` に pricing 専用ヘルパ（採用）
- B. `src/server/shared/infrastructure/` に汎用配置
- 推奨/採用: A。版バンプ・append-only 期間同期は販売単価集約に固有のパターンで、汎用 `dateRange.ts`（shared）とは関心が異なる。pricing/infrastructure に閉じれば DDD レイヤリング規則（infra 層内）も満たす。

### 識別子（table 名・列名）の埋め込み
- `$executeRaw` は値しかバインドできないため、table 名・キー列名は `Prisma.raw()` で埋め込む。これらは**リポジトリ内のコンパイル時定数のみ**でユーザー入力を一切含まないため安全。可変長の複合キー値は `Prisma.join()` で組み立てる。daterange 生成は既存の `dateRangeValue`（`src/server/shared/infrastructure/dateRange.ts`）を引き続き使用。

### `update` の version チェックの分解粒度
- 型付き `updateMany`（Prisma モデルアクセサ・WHERE キーがモデル固有）はリポジトリに残し、`count === 0 → ConflictError` の判定だけを `assertVersionBumped` ヘルパに抽出。理由: モデルアクセサごと共通化するとジェネリクスで型安全が崩れるため、型の効く部分は残す。

## ステップ

### Step 1: 共通ヘルパモジュールを新設（純粋ヘルパは単体テスト付き）
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/prisma/sellingPricePeriodPersistence.ts`（新規）
  - `src/server/subdomains/pricing/infrastructure/prisma/__tests__/sellingPricePeriodPersistence.test.ts`（新規）
- 作業内容:
  - `translateInsertConflict(error: unknown, conflictMessage: string): never` — P2002 なら `new ConflictError(conflictMessage)`、それ以外は rethrow。集約型に依存しないようメッセージは呼び出し側が組み立てて渡す。
  - `assertVersionBumped(count: number): void` — `count === 0` で楽観ロック ConflictError（固定メッセージ）を throw。
  - `appendPeriodRows(tx, config, rows): Promise<void>` — `config: { table: string; keyColumns: readonly string[] }`、`rows: { id; keyValues: readonly string[]; sellingPrice; start; end }[]`。`INSERT INTO <table> (id, <keyColumns>, selling_price, applicable_period, updated_at) VALUES (...) ON CONFLICT (id) DO NOTHING` を `Prisma.raw`（識別子）＋ `Prisma.join`（可変長キー値）＋ `dateRangeValue` で組み立て、行ごとにループ実行。N+1 改善時はこのループを複数行 VALUES に差し替えるだけで済むことをコメントで明示。
  - `Tx = Prisma.TransactionClient` 型エイリアスもここへ集約。
  - テストは純粋な2ヘルパ（`translateInsertConflict` / `assertVersionBumped`）の分岐を網羅。`appendPeriodRows` は DB 依存のため既存リポジトリ結合テストに委ね、本ファイルでは扱わない旨をコメント。
- コミットメッセージ: `refactor: 販売単価リポジトリの永続化共通ヘルパを新設`（ボディに「関数ヘルパ採用の理由＝ADR-8tg の明示的重複方針／型付きアクセサ温存」「識別子は定数のみで Prisma.raw 安全」を記載）

### Step 2: PrismaCommonSellingPriceRepository をヘルパへ移行
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository.ts`
- 作業内容:
  - `writePeriods` を `appendPeriodRows(tx, { table: "common_selling_price_periods", keyColumns: ["product_id"] }, Mapper.toPeriodWriteRows(aggregate).map(...))` 呼び出しに置換。
  - `translateInsertConflict`（static private）を削除し、`catch` で共通ヘルパ `translateInsertConflict(error, "<商品...既に登録...>" )` を呼ぶ。
  - `update` の `result.count === 0` ブロックを `assertVersionBumped(result.count)` に置換。`updateMany` 呼び出しはそのまま残す。
  - ローカルの `type Tx` 定義を削除しヘルパから import。
  - 既存の結合テスト `__tests__/PrismaCommonSellingPriceRepository.test.ts` を実行し緑を確認（挙動不変）。
- コミットメッセージ: `refactor: 共通販売単価リポジトリを永続化共通ヘルパへ移行`

### Step 3: PrismaCustomerSellingPriceRepository をヘルパへ移行
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/prisma/PrismaCustomerSellingPriceRepository.ts`
- 作業内容:
  - Step 2 と同型。`appendPeriodRows` の config を `{ table: "customer_selling_price_periods", keyColumns: ["customer_id", "product_id"] }`、`keyValues: [r.customerId, r.productId]` とする。
  - `translateInsertConflict` のメッセージは得意先×商品の既存文言を維持。`update` の複合キー `updateMany` は残し `assertVersionBumped` のみ適用。
  - 既存結合テストを実行し緑を確認。
- コミットメッセージ: `refactor: 得意先別販売単価リポジトリを永続化共通ヘルパへ移行`

### Step 4: PrismaDeliveryLocationSellingPriceRepository をヘルパへ移行
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository.ts`
- 作業内容:
  - Step 3 と同型。config を `{ table: "delivery_location_selling_price_periods", keyColumns: ["delivery_location_id", "product_id"] }`、`keyValues: [r.deliveryLocationId, r.productId]`。
  - 既存結合テストを実行し緑を確認。
- コミットメッセージ: `refactor: 納品先別販売単価リポジトリを永続化共通ヘルパへ移行`

### Step 5: ADR-8tg の複製範囲記述を実態へ更新＋リポジトリ doc コメント整理
- 対象ファイル:
  - `docs/adr/20260624-8tg-override-selling-price-isomorphic-aggregates.md`
  - 必要に応じ3リポジトリの class doc コメント（重複前提の記述を共通ヘルパ参照へ）
- 作業内容:
  - ADR 43行目「重複の実体が小さい…table 名違いだけ」を、実際は `writePeriods`/`translateInsertConflict`/`update` の3メソッドが広範に複製されていた事実と、#458 で infra 層の関数ヘルパ（`sellingPricePeriodPersistence.ts`）へ抽出して解消した旨に追記修正。葉 VO 共有・継承不採用（A）の本決定は維持されること（共通化は infra 実装詳細で、ドメイン集約の独立性は不変）を明記。「影響」節に #458 の追補を1行追加。
  - 3リポジトリの class doc コメントから「table 名違いだけ」前提の文言があれば共通ヘルパへの参照に更新。
- コミットメッセージ: `docs: ADR-8tg の販売単価リポジトリ複製範囲の記述を実態へ更新（#458）`

## 検証

- 単体: `pnpm test src/server/subdomains/pricing/infrastructure/prisma/__tests__/sellingPricePeriodPersistence.test.ts`（Step 1 の純粋ヘルパ）。
- 結合（実 DB）: 各 Step で対象リポジトリの既存結合テストを実行。最終的に
  `pnpm test src/server/subdomains/pricing/infrastructure/prisma/__tests__/` で3リポジトリ×全ケース緑を確認（往復・append-only の updated_at 保持・古い version の ConflictError・二重 insert の ConflictError・EXCLUDE 制約）。挙動不変が安全網。
- 静的: `pnpm lint` と型チェックで `Prisma.raw`/`Prisma.join` の組み立てと import 整理を確認。
- DDD 規則: 新ヘルパが domain/application/presentation を import しないこと（infra→shared infra の `dateRange` 参照のみ）を目視確認。

## 補足

- Issue 本文の関連参照 `#1`（N+1 INSERT）・`#429`（removePeriod）は当リポジトリの実 Issue 番号（#1=Learning 系・#429=保守画面 CRUD）と一致せず、本文のプレースホルダと判断。本計画では番号に依存しない。
- 計画からの逸脱が生じた場合は `docs/claude-plans/issue-458/deviations.md` に記録（CLAUDE.md ルール）。
