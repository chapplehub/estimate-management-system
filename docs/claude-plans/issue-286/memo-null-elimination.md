# Issue #286 後続: Memo の null 排除リファクタ（A案: 空値 Null Object）— 実装計画

## Context

Issue #286 の VO 化リファクタ完了後のレビューで、`Memo` を `Memo | null` で扱った結果 **`EstimateMapper` に null 分岐が漏れ込み**、`Memo | null` がエンティティ全体（フィールド/ゲッター/`change*`/`create`/`reconstruct`）に伝播していることが問題視された。これは「DB の `string | null`」と「ドメインの `Memo | null`」という2つの null 表現のインピーダンスミスマッチであり、プロジェクトの NULL 徹底排除方針（kawasima デシジョンツリー準拠）とも噛み合わない。

本計画は **本計画群の「論点2: `Memo | null` 採用」を上書きする後続決定**。「メモ未入力」を null ではなく**空 Memo（`value === ""`）**で表現し、`null→空` の正規化を **`Memo.create` の1点に集約**して null をドメイン（移行後は DB）からも排除する。ハンドオフ（`value-object-extraction.md` §追補 2026-06-03）の A 案を実装する。

### 事実確認（調査済み）
- memo の外部消費者（アプリ/プレゼン層）は無し。`prisma/seed-e2e.ts` 等に estimate 挿入も無し → **NOT NULL 移行で壊れる既存データ・シードは存在しない**（バックフィルは実質 no-op だが冪等な安全策として入れる）。
- `private constructor` + 静的ファクトリは既存流儀（`Money.fromMajorUnits` / `EstimateNumber.parse` 等）。`Memo.create` は idiomatic。
- ADR は 0033 まで存在 → 次は **0034**（`docs/adr/TEMPLATE.md` / `INDEX.md` あり）。
- `db:migrate` = `prisma migrate dev`（dev DB を実変更）。

## 確定した設計判断（ユーザー確認済み）

1. **null 排除モデル = A案**: 空値 Null Object（サブクラス無し）。`Memo.create(string|null|undefined)` が唯一の入口で null/空白を空 Memo に正規化。`Memo.empty()` は `create(null)` の読みやすさ用ヘルパ。多態 `NullMemo` は派生の振る舞いが無いため不採用。
2. **`create` 入力シグネチャ = 案X**: `EstimateItem.create` / `EstimateVariation.create` の memo 引数は `Memo`（非null・省略可）。省略時は `Memo.empty()`。ItemName/Unit と対称（呼び出し側が VO を構築）。null 吸収は呼び出し側の `Memo.create()` に集約。
3. **マイグレーション = 生成＋dev DB 適用まで**。生成 SQL 先頭に冪等な `UPDATE ... SET <col> = '' WHERE <col> IS NULL;` を手で入れてから NOT NULL 化。
4. **ADR 0034 を私がドラフト起票**（Considered Options / Decision=A / Consequences）＋ `INDEX.md` 更新。ユーザーがレビューで調整。

## ステップ（1ステップ=1コミット）

### Step A-1: `Memo` を A案形に差し替え＋テスト更新
- `src/server/subdomains/estimate/domain/values/Memo.ts`:
  - `private constructor(value: string)`（`super(value.trim())`）
  - `static create(value: string | null | undefined): Memo { return new Memo(value ?? ""); }`
  - `static empty(): Memo { return Memo.create(null); }`
  - `isEmpty(): boolean { return this.value.length === 0; }`
  - クラス JSDoc を「未入力は空 Memo で表現／null 吸収は create に集約」に更新（現行の "`Memo | null` で扱う" 記述を置換）。
- `__tests__/Memo.test.ts`: `new Memo(...)` 直書きを `Memo.create(...)` 経由に変更。追加: `create(null)`/`create(undefined)`/`create("")`/`create("   ")` がすべて `isEmpty() === true`、通常値の保持・トリム・境界 max(2000)・max+1 で `ValidationError`、`empty().isEmpty()` を網羅。
- commit: `refactor(estimate): Memo を null 排除（空値 Null Object）に変更する`（body に「論点2 を上書き。null 吸収を create に集約。多態サブクラスは派生の振る舞いが無いため不採用」）

### Step A-2: エンティティから `Memo | null` を除去
- `EstimateItem.ts` / `EstimateVariation.ts`:
  - `_customerMemo` / `_internalMemo` フィールド、ゲッター、`create` input、`reconstruct` input、`change*` 引数の `Memo | null` を **すべて `Memo`** に変更。
  - `create` の未入力デフォルト: `input.customerMemo ?? Memo.empty()`（internalMemo も同様）。
  - `EstimateItem` の `import { Memo }` は既存のまま流用。
- commit: `refactor(estimate): EstimateItem / EstimateVariation の memo を非null Memo に統一する`

### Step A-3: `EstimateMapper` の null 分岐除去
- `itemToDomain` / `variationToDomain`: `... ? new Memo(...) : null` → `Memo.create(i.customerMemo)` / `Memo.create(v.customerMemo)`（計4箇所）。
- `toItemScalarData` / `toVariationScalarData`: `?.value ?? null` → `i.customerMemo.value`（計4箇所）。
- commit: `refactor(estimate): EstimateMapper の memo null 分岐を除去する`

### Step A-4: Prisma スキーマを NOT NULL + default '' に移行
- `prisma/schema.prisma` の memo 4 列（EstimateItem 側 `customer_memo`/`internal_memo` ＝ L570-571、EstimateVariation 側 ＝ L627-628）:
  - `String? @db.VarChar(2000)` → `String @default("") @db.VarChar(2000)`。
- `pnpm db:migrate` でマイグレーション生成 → 生成 SQL を確認し、NOT NULL 化前に `UPDATE "<table>" SET "<col>" = '' WHERE "<col>" IS NULL;`（memo 4 列分）を**先頭に手挿入** → 適用。`pnpm db:generate`。
- commit: `refactor(estimate): memo 列を NOT NULL default '' に移行する`

### Step A-5: テストフィクスチャ・既存テストの追従
- `estimateAggregateBuilder.ts`: memo を渡していない（省略）箇所は案X の既定 `Memo.empty()` で動くため原則変更不要。memo を明示構築している箇所があれば `Memo.create(...)` に。
- `EstimateItem.test.ts`: 「memo は省略可能」テストの `expect(item.customerMemo).toBeNull()` → `expect(item.customerMemo.isEmpty()).toBe(true)`。`changeCustomerMemo` テストの `new Memo("初期メモ")`→`Memo.create("初期メモ")`、`item.customerMemo?.value`→`item.customerMemo.value`、クリアは `changeCustomerMemo(Memo.empty())` で `isEmpty()` 検証。
- `EstimateVariation.test.ts` / `Estimate.test.ts` / `PrismaEstimateRepository.test.ts`: 同様に `Memo | null` 前提の構築/assertion を `Memo`（`isEmpty()`）へ修正。ラウンドトリップで空メモが `""` のまま保たれることを確認。
- commit: `test(estimate): memo の null 排除に追従しテストを更新する`

### Step A-6: ADR 起票・deviations 追記・最終検証
- `docs/adr/0034-*.md` を `TEMPLATE.md` に従い起票（Considered Options = `Memo|null` / 多態NullMemo / A / B / C、Decision = A、Consequences = null排除・StringValueObject family 形との折り合い・将来の多態昇格シグナル）。`docs/adr/INDEX.md` に追記。
- `docs/claude-plans/issue-286/deviations.md` に追記: {元の計画: 論点2 `Memo | null`}/{実際: 非null Memo + `Memo.create`}/{理由: Mapper の null 分岐除去と NULL 排除方針整合}。
- `pnpm test` / `pnpm build` / `pnpm lint` 通過確認。
- commit: `docs(estimate): Memo null 排除の ADR 0034 を追加し逸脱を記録する`

## 検証（Verification）

- `pnpm test`: 全通過（Memo テスト＋エンティティ/マッパー/リポジトリテスト）。
- `pnpm build`: 型エラー無し（`Memo | null` 消滅で下流の非null が型保証される）。
- `pnpm lint`: 通過。
- ラウンドトリップ: `PrismaEstimateRepository.test.ts` で toDomain→scalarData→再toDomain により**空メモが `""` で安定**（null に戻らない）こと。

## 受け入れ確認

- `grep -rn "Memo | null" src/server/subdomains/estimate` が **0 件**。
- `EstimateMapper` に memo 関連の `? new Memo` および `?.value ?? null` が **0 件**。
- `prisma/schema.prisma` の memo 4 列に `?`（nullable）が無く `@default("")` が付く。
- `docs/adr/0034-*.md` が存在し `INDEX.md` に登録済み。
