# Issue #286: refactor(estimate): EstimateItem の itemName / unit / memo をプリミティブから値オブジェクト化する — 実装計画

## Context

Issue #284 で Estimate 集約を実装した際、`EstimateItem` の `itemName` / `unit` / `customerMemo` / `internalMemo` を VO 化せず `string` のまま受けた（判断理由: `docs/claude-plans/issue-284/deviations.md §5`）。現状はエンティティ内に `private static assertItemName / assertUnit / assertMemo` を置いて検証している。

このリファクタは上記プリミティブ受けを `ItemName` / `Unit` / `Memo` の3つの値オブジェクトに置き換え、検証責務を VO のコンストラクタに移譲する。これにより `EstimateItem` から検証ヘルパが消え、ドメインモデルの型安全性と意図表現が向上する。`Memo` は `EstimateItem` だけでなく `EstimateVariation` の `customerMemo` / `internalMemo`（同一制約: `VarChar(2000)`）にも横断適用する。

完了条件（抜粋）: VO 3 種＋単体テスト追加 / `EstimateItem` の対象 string 型が全消去 / `assert*` 削除 / Prisma マッピング対応 / `pnpm test` `pnpm build` 通過。

## 設計判断（ユーザー確認済み）

### 論点1: マスタ側 VO の共有判断（ItemName / Unit）
- A. 全て estimate 独自で新設 ← **採用**
- B. Product の `ProductName` / `ProductUnit` を再利用
- 採用理由: スナップショットは見積時点の**凍結値**であり、Product 側の制約（特に `ProductUnit` は enum 6 値）に結合させると、将来 enum 値が変わった際に過去スナップショットの `reconstruct` が壊れる。estimate コンテキストの独立性を保つため独自 VO とする。`ProductId` のような cross-context 参照（identity）とは異なり、snapshot 属性は estimate 側に閉じた copy として持つ。

### 論点2: `Memo` の null 許容モデル
- 既存流儀（`ProductNote | null`、`Product.ts:32`）に合わせ `Memo | null` とする。VO 内部で null を表現しない。→ 判断不要（規約踏襲）

### 論点3: VO に `withFoo` 遷移メソッドを持たせるか
- 既存 VO（Product 系）に `withFoo` は無く、`change*` は全置換。Memo も全置換のため不要。→ 判断不要（規約踏襲）

### 論点4: `Memo` のエラーメッセージ label
- A. 共有 `Memo` VO ＋ 汎用 label（`LABEL = "メモ"`）← **採用**
- B. `CustomerMemo` / `InternalMemo` を別 VO に分離
- 採用理由: Memo は最大長のみの技術的制約であり、`顧客/社内` の区別を失っても実害が小さい。エラーは「メモは2000文字以内で入力してください」。最もシンプル。

### 関連スコープ: EstimateVariation の memo
- **同 PR で全置換**（採用）。`EstimateVariation` の `customerMemo` / `internalMemo` も `VarChar(2000)`・同一バリデーションのため同じ `Memo` VO に置換する。

### 補足: バレル整理
- `estimate/domain/values/` および `product/domain/values/` に `index.ts` バレルは存在しない（直接 import 流儀）。Issue チェックリストの「バレル整理」は N/A。新 VO も直接 import で参照する。

## 実装方針メモ

- 基底クラス `StringValueObject<U>`（`src/server/shared/StringValueObject.ts`）を継承。`LABEL` / `MIN_LENGTH` / `MAX_LENGTH` の override でエラーメッセージは自動生成される。
- 既存の手本: `FaultDescription`（必須・トリム・max 制約のミニマル VO, `estimate/domain/values/FaultDescription.ts`）、`ProductName`（max100/必須）、`ProductNote`（max・任意）。
- VO 仕様:
  - `ItemName`: `LABEL="商品名"`, `MIN_LENGTH=1`, `MAX_LENGTH=100`, コンストラクタで `trim()`。
  - `Unit`: `LABEL="単位"`, `MIN_LENGTH=1`, `MAX_LENGTH=20`, `trim()`。（enum ではなくスナップショット文字列なので自由文字列）
  - `Memo`: `LABEL="メモ"`, `MAX_LENGTH=2000`（MIN 無し）, `trim()`。null は `Memo | null` で表現。
- ブラスト半径（調査済み）:
  - ドメイン: `EstimateItem.ts` / `EstimateVariation.ts`
  - インフラ: `EstimateMapper.ts`（`itemToDomain` / `variationToDomain` / `toItemScalarData` / `toVariationScalarData`）
  - テスト: `estimateAggregateBuilder.ts`（中心フィクスチャ）, `EstimateItem.test.ts`, `EstimateVariation.test.ts`, `Estimate.test.ts`, `PrismaEstimateRepository.test.ts`
- マッピング変換規約:
  - 読み（toDomain）: `itemName: new ItemName(i.itemName)` / `unit: new Unit(i.unit)` / `customerMemo: i.customerMemo ? new Memo(i.customerMemo) : null`
  - 書き（scalarData）: `itemName: i.itemName.value` / `unit: i.unit.value` / `customerMemo: i.customerMemo?.value ?? null`

## ステップ

### Step 1: ItemName / Unit / Memo VO ＋ 単体テストを追加
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/ItemName.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/Unit.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/Memo.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/__tests__/ItemName.test.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/__tests__/Unit.test.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/__tests__/Memo.test.ts`（新規）
- 作業内容:
  - `StringValueObject` 継承で 3 VO を実装（上記「VO 仕様」通り）
  - 各テストは `FaultDescription.test.ts` の粒度に合わせ、正常系（通常値・トリム・境界 max 文字）/ 異常系（空文字・空白のみ・max+1 文字）を網羅。`Memo` は max のみ（空文字許容、null は呼び出し側責務なので VO テストでは扱わない）
- コミットメッセージ: `feat(estimate): ItemName / Unit / Memo 値オブジェクトを追加する`

### Step 2: EstimateItem を VO ベースに差し替え
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateItem.ts`
  - `src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts`（item 側: `itemToDomain` / `toItemScalarData`）
  - `src/server/subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder.ts`
  - `src/server/subdomains/estimate/domain/entities/__tests__/EstimateItem.test.ts`
  - `src/server/subdomains/estimate/domain/entities/__tests__/Estimate.test.ts`
  - `src/server/subdomains/estimate/infrastructure/prisma/__tests__/PrismaEstimateRepository.test.ts`（item 構築箇所）
- 作業内容:
  - `EstimateItemCreateInput` / コンストラクタ / `reconstruct` / `changeItemName` / `changeUnit` / `changeCustomerMemo` / `changeInternalMemo` / ゲッターのシグネチャを `string` → `ItemName` / `Unit` / `Memo`（memo は `Memo | null`）に差し替え
  - `private static assertItemName / assertUnit / assertMemo` と定数 `ITEM_NAME_MAX` / `UNIT_MAX` / `MEMO_MAX`、`ValidationError` import を削除（検証は VO に移譲）
  - `EstimateMapper` の item 側で `string <-> VO` 変換を追加
  - テストフィクスチャ・テストの呼び出し側を VO 生成（`new ItemName(...)` 等）に更新
- コミットメッセージ: `refactor(estimate): EstimateItem の itemName / unit / memo を値オブジェクト化する`
  - body に「検証責務を assert* から VO コンストラクタへ移譲。Unit は Product enum を再利用せず estimate 独自の自由文字列 VO とした（スナップショット凍結値のため）」を記載

### Step 3: EstimateVariation の memo を Memo VO に差し替え（関連スコープ）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`
  - `src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts`（variation 側: `variationToDomain` / `toVariationScalarData`）
  - `src/server/subdomains/estimate/domain/entities/__tests__/EstimateVariation.test.ts`
  - `src/server/subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder.ts`（variation 構築箇所、Step 2 で未対応なら）
  - `src/server/subdomains/estimate/infrastructure/prisma/__tests__/PrismaEstimateRepository.test.ts`（variation 構築箇所）
- 作業内容:
  - `customerMemo` / `internalMemo` の create input / コンストラクタ / `reconstruct` / `change*` / ゲッターを `Memo | null` に差し替え
  - `private static assertMemo` と `MEMO_MAX` を削除
  - `EstimateMapper` の variation 側で `string <-> VO` 変換を追加
  - テスト呼び出し側を更新
- コミットメッセージ: `refactor(estimate): EstimateVariation の memo を Memo 値オブジェクトに統一する`

### Step 4: 検証 ＆ 逸脱記録
- 対象ファイル:
  - `docs/claude-plans/issue-286/deviations.md`（計画と差異が出た場合のみ）
- 作業内容:
  - `pnpm test` 通過確認
  - `pnpm build`（型チェック）通過確認
  - `pnpm lint` 確認
  - 計画から逸脱した点があれば deviations.md に {元の計画}/{実際}/{理由} を記録
- コミットメッセージ:（逸脱記録が発生した場合のみ）`docs(estimate): issue-286 の実装逸脱を記録する`

## 検証（Verification）

- 単体テスト: `pnpm test`（新 VO テスト 3 ファイル＋既存エンティティ/マッパーテストが全通過すること）
- 型チェック: `pnpm build`（`EstimateItem` / `EstimateVariation` の全シグネチャから対象 `string` 型が消え、型エラーが無いこと）
- Lint: `pnpm lint`
- 受け入れ確認:
  - `EstimateItem` に `assertItemName / assertUnit / assertMemo` が存在しない（grep で 0 件）
  - `EstimateMapper` ラウンドトリップ（`toDomain` → scalarData → 再 `toDomain`）が `PrismaEstimateRepository.test.ts` で破綻しない

---

# 追補（2026-06-03）: Memo の null 排除リファクタ（A案採用）— 別セッション向けハンドオフ

> このセクションは **本計画の「論点2: `Memo` の null 許容モデル」（`Memo | null` 採用）を上書きする後続決定** のハンドオフ。実装は別セッションで行う。ここに「採用案の定義」「なぜAか（ADR用のWHY）」「実装ステップ」を自己完結でまとめる。

## きっかけ（Problem）

VO 化リファクタ完了後のレビューで、`Memo` を任意項目として `Memo | null` で扱った結果、**`EstimateMapper` に null 分岐が漏れ込んでいる**ことが問題視された:

```ts
// 読み（toDomain）
customerMemo: v.customerMemo ? new Memo(v.customerMemo) : null,
// 書き（scalarData）
customerMemo: v.customerMemo?.value ?? null,
```

この分岐は本質的に「DB の `string | null`」と「ドメインの `Memo | null`」という **2つの null 表現のインピーダンスミスマッチ**であり、`Memo | null` を使う限り境界で必ず発生する。加えて `Memo | null` がエンティティ全体（フィールド / ゲッター / `change*` / `create` / `reconstruct`）に伝播し、利用側に null 判断が漏れ続ける。プロジェクトの **NULL 徹底排除方針**（kawasima デシジョンツリー準拠、ユーザーメモリ参照）とも噛み合わない。

## 採用案: A — 静的ファクトリ `Memo.create` ＋ 空値による Null Object（サブクラス無し）

「メモ未入力」を **null ではなく空 Memo（`value === ""`）** で表現し、null をドメインから完全に排除する。null→空の正規化は **`Memo.create` の1点に集約**する。

### `Memo`（差し替え後の最終形）

```ts
import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * メモ値オブジェクト（任意項目）
 *
 * 「未入力」は null ではなく空 Memo（value === ""）で表現する。
 * null / undefined / 空白のみ の吸収は create に一極集中させ、
 * ドメイン内には Memo（非null）だけを流す。
 */
export class Memo extends StringValueObject<"Memo"> {
  protected static readonly LABEL = "メモ";
  protected static readonly MAX_LENGTH = 2000;

  // 生成は必ず create 経由に強制する（family の "string から作る" 形を守るため引数は string のまま）
  private constructor(value: string) {
    super(value.trim());
  }

  /** 任意入力の唯一の入口。null / undefined / 空白 はすべて空 Memo に正規化する */
  static create(value: string | null | undefined): Memo {
    return new Memo(value ?? "");
  }

  /** 「メモなし」を明示的に作る読みやすさ用ヘルパ（= create(null)）。clear 操作やテストで使う */
  static empty(): Memo {
    return Memo.create(null);
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }
}
```

- 最大長超過の検証は `new Memo(...)` → 基底 `validate` で従来通り効く（`ValidationError` を投げる）。
- 空白のみ `"   "` は `trim()` で空 Memo になる（= 未入力と同一視）。

### 利用側（すべて「素通し」になる）

```ts
// EstimateItem.create / EstimateVariation.create — フォーム値を素通し
customerMemo: Memo.create(input.customerMemo),

// EstimateMapper.toDomain — 移行後は v.customerMemo: string だが create は string|null|undefined を許容
customerMemo: Memo.create(v.customerMemo),

// EstimateMapper.scalarData（書き戻し）— 常に non-null
customerMemo: i.customerMemo.value,   // 空メモは "" として保存

// change 系 — クリアは Memo.empty() を渡す
changeCustomerMemo(newMemo: Memo): void { this._customerMemo = newMemo; }
```

## なぜAなのか（ADR用 — Decision & Rationale）

### なぜ「空値 Null Object」か（`Memo | null` を捨てた理由）

1. **NULL 排除方針との整合**: ドメインからも（移行後は）DB からも null を消せる。
2. **意味論的に正直**: 自由文 memo では「空メモ」と「メモなし」に**業務的な差が無い**。両者が等価なときに限り Null Object は嘘にならない（対比: NULL に「未発注」等の意味がある日付列では Null Object は不正）。
3. **複雑性の消滅**: Mapper の分岐が消え、エンティティから `Memo | null` が消える。フィールド型を `Memo`（非null）にした瞬間、**型システムが下流の非null を保証**する（`create` の `?? ""` という1点に null 吸収が集約され、以降は分岐不要）。

### なぜ「多態サブクラス `NullMemo`」を採らないか（Null Object の別実装の棄却）

C# 的な `class NullMemo extends Memo`（`forDisplay()` 等を override する正統な多態 Null Object）も検討したが棄却。**多態サブクラスが空値版に勝てるのは「不在」と「空値」で分岐させたい派生メソッドがあるときだけ**（C# の `名前様付` のように、空文字を通常経路に流すと壊れる派生表示があるケース）。現状の `Memo` は `.value` を返すだけの素の文字列 VO で派生の振る舞いが無く、`NullMemo` と `new Memo("")` は**振る舞いが完全一致**する。型を1つ増やす対価が無い（参照: `learning/value-object-vs-result-object-for-staged-amounts.md` の「型を作らない勇気」）。
→ 将来 `Memo` に「不在のとき空文字処理とは違う見せ方をする派生メソッド」（例: 帳票で接頭辞付与、空なら行ごと削除）が生えたら、その時点で多態版へ部分昇格する。

### なぜ null 吸収を「ファクトリ(A)」に置くか（B/C の棄却）

null 吸収の**置き場所**として3案を比較した:

| 案 | 生成 | null 吸収の場所 | トレードオフ |
|---|---|---|---|
| **A. `Memo.create(nullable)`** ← 採用 | ファクトリ | create 内 | `StringValueObject` family の "string から作る" 形を保てる／null 漏れ無し。対価: 他VO（`new`）と生成形が割れる |
| B. nullable コンストラクタ | `new` | ctor 内 | `new` 流儀で最も一貫・呼び出し最簡。対価: ctor 引数が `string\|null\|undefined` になり family の形から逸脱 |
| C. 厳格 ctor + 呼び出し側 `?? ""` | `new` | 各呼び出し側 | ctor 純粋。対価: `?? ""` が 4 箇所に漏れる（当初の不満点が再発） |

- **C 棄却**: null 判断が呼び出し側に漏れる（そもそもの問題の再来）。
- **B 棄却**: `new` の一貫性は最良だが、ctor 引数を nullable に広げると `StringValueObject` ファミリの「string から作る」一様な形から外れる。なお **これは LSP 違反ではない**（コンストラクタは継承されず多態呼び出しもされないため LSP の射程外。引数を広げるのは変性的にも安全側。基底不変条件も super 前正規化で保存される）。あくまで「ファミリの形の純度」という設計趣味の問題。
- **A 採用**: ctor 引数を `string` のまま（family の形を維持）し、nullable の関心を `create` という名前付き入口に隔離。**コードベースは既に `new`（ItemName / Quantity / TaxRate）と ファクトリ（`Money.fromMajorUnits` / `EstimateNumber.parse` / `SubmissionType.from`）を「生成時に変換が要るか」で使い分けており**、`Memo.create` は「null→空 正規化」という実変換を伴うので、この既存の軸に整合する（＝ `create` は不揃いではなく正当）。

### 決定の要点（一文）

> 任意項目の memo を `Memo | null` ではなく **常に non-null な Memo（空が未入力）** とし、`null → 空` の吸収を **`Memo.create` の1点**に集約する。多態サブクラスは派生の振る舞いが無いため使わず、ファクトリは「変換を伴う生成」という既存コードベースの方針に沿うため `new` 直書きより優先する。

## 実装ステップ（別セッション）

> ブランチ運用・コミット粒度は本計画の流儀（意味のあるまとまりごとにコミット）に従う。

### Step A-1: `Memo` を A 案形に差し替え＋テスト更新
- `src/server/subdomains/estimate/domain/values/Memo.ts`: 上記「最終形」に置換（private ctor / `create` / `empty` / `isEmpty`）。
- `src/server/subdomains/estimate/domain/values/__tests__/Memo.test.ts`: `Memo.create(null)` / `create(undefined)` / `create("")` / `create("   ")` がすべて `isEmpty() === true` になること、通常値の保持・トリム・境界 max・max+1 で `ValidationError`、を網羅。`new Memo(...)` 直書きのテストは `create` 経由に変更。
- commit: `refactor(estimate): Memo を null 排除（空値 Null Object）に変更する`
  - body に「論点2（`Memo | null`）を上書き。null 吸収を create に集約し、ドメインから Memo | null を排除。多態サブクラスは派生の振る舞いが無いため不採用」を記載。

### Step A-2: エンティティから `Memo | null` を除去
- `EstimateItem.ts` / `EstimateVariation.ts`:
  - `_customerMemo` / `_internalMemo` フィールド、ゲッター、`create` input、`reconstruct` input、`change*` 引数の `Memo | null` を **すべて `Memo`** に変更。
  - `create` の未入力デフォルトを `?? null` → `Memo.create(input.customerMemo)` 等に変更（input が `Memo | null` か生 string かは現行シグネチャ確認の上、生値素通しなら `Memo.create(...)`、既に `Memo` を受けているなら `?? Memo.empty()`）。
  - clear 操作は `change*(Memo.empty())`。
- commit: `refactor(estimate): EstimateItem / EstimateVariation の memo を非null Memo に統一する`

### Step A-3: `EstimateMapper` の分岐除去
- `variationToDomain` / `itemToDomain`: `... ? new Memo(...) : null` → `Memo.create(v.customerMemo)` / `Memo.create(i.customerMemo)`。
- `toVariationScalarData` / `toItemScalarData`: `?.value ?? null` → `i.customerMemo.value`（4 箇所）。
- commit: `refactor(estimate): EstimateMapper の memo null 分岐を除去する`

### Step A-4: Prisma スキーマを NOT NULL + default に移行
- `prisma/schema.prisma` の memo 4 列（EstimateItem 側 `customer_memo`/`internal_memo` ＝ 現 L570-571、EstimateVariation 側 ＝ 現 L627-628）:
  - `String? @db.VarChar(2000)` → `String @default("") @db.VarChar(2000)`。
- `pnpm db:migrate` で生成されるマイグレーション SQL を**手で確認・補正**: NOT NULL 化の前に既存 NULL を空文字へバックフィルする `UPDATE ... SET <col> = '' WHERE <col> IS NULL;` を必ず先頭に入れる（Prisma が自動生成しない場合があるため）。
- commit: `refactor(estimate): memo 列を NOT NULL default '' に移行する`

### Step A-5: テストフィクスチャ・検証・記録
- `estimateAggregateBuilder.ts` / `EstimateItem.test.ts` / `EstimateVariation.test.ts` / `Estimate.test.ts` / `PrismaEstimateRepository.test.ts` の memo 構築を `Memo.create(...)` / `Memo.empty()` に更新。`Memo | null` を期待する assertion を `Memo`（空判定 `isEmpty()`）に修正。
- `pnpm test` / `pnpm build` / `pnpm lint` 通過確認。ラウンドトリップ（toDomain→scalarData→再toDomain）で空メモが `""` のまま保たれること。
- **ADR 追加**: 本追補の「なぜAなのか」を元に ADR を起票（Considered Options = `Memo|null` / 多態NullMemo / A / B / C、Decision = A、Consequences = null排除・family形との折り合い・将来の多態昇格シグナル）。`docs/adr/` の採番規約に従う。
- **deviations.md 記録**: 本計画「論点2」を上書きした旨（{元の計画: `Memo | null`}/{実際: 非null Memo + create}/{理由: Mapper の null 分岐除去と NULL 排除方針整合}）を `docs/claude-plans/issue-286/deviations.md` に追記。

## 受け入れ確認（追加分）
- `grep -rn "Memo | null" src/server/subdomains/estimate` が 0 件。
- `EstimateMapper` に `? new Memo` および `?.value ?? null`（memo 関連）が 0 件。
- Prisma スキーマの memo 4 列に `?`（nullable）が無く `@default("")` が付く。
- 空メモのラウンドトリップが `""` で安定（null に戻らない）。
