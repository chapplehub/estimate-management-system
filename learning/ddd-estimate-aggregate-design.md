# Estimate 集約の設計メモ — DDD 集約ルート・境界・readonly

作成日: 2026-06-01

## 概要

Issue #284 の Estimate 集約実装をもとに、DDD の集約まわりで初学者が引っかかる 3 つの論点を整理。

1. なぜ EstimateVariation に「明細委譲メソッド群」があるのか（= 集約境界の意味）
2. なぜ `items` ゲッターが `ReadonlyArray<Readonly<EstimateItem>>` なのか（= 何を防ぎたいか）
3. 集約ルート Estimate のメソッド数が多いのは仕方ないのか（= 粒度設計の話）

対象コード:

- `src/server/subdomains/estimate/domain/entities/Estimate.ts`
- `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`
- `src/server/subdomains/estimate/domain/entities/index.ts` (バレル)
- `eslint.config.mjs` (集約境界規約)

---

## 詳細

### 1. 集約境界と「外部」の定義

「集約境界規約により子 EstimateItem を**外部**から直接操作できない」の「外部」とは:

- ✅ EstimateVariation 自身 → OK（同じ `entities/` 配下、ESLint オーバーライドで相対 import 可）
- ✅ Estimate（集約ルート）自身 → OK（Variation 経由で操作）
- ❌ アプリ層 (UseCase) → 不可（バレル非公開 + ESLint で import 禁止）
- ❌ インフラ層 → 不可

つまり「**親子関係**」と「**集約境界**」は別概念:

- 親子関係: Estimate ⊃ Variation ⊃ Item という構造上の包含
- 集約境界: 不変条件の責任範囲。境界の入口（= 集約ルート）に責任を集中させる

#### なぜ Variation に `changeItem*` 委譲メソッドが必要か

集約内不変条件「**集計が常に最新**」を守るため。Variation の全 mutator は最後に `recalculate(tax)` を呼ぶ構造になっている (`EstimateVariation.ts:149-187`)。

もしアプリ層から `variation.items[0].changeQuantity(...)` が呼べてしまうと:

```ts
// 仮にこれが許されていたら…
const item = estimate.variations[0].items[0];
item.changeQuantity(Quantity.of(10));
// → EstimateItem.finalAmount は更新される
// → でも Variation の subtotal / taxAmount / finalTotal は古いまま
// → 集約の不変条件が静かに壊れる
```

なので「**呼び忘れる可能性のあるインターフェースを集約外に出さない**」のが DDD 集約ルートの本来の意義。

委譲チェーン:

```
アプリ層 → Estimate.changeItemQuantity(varId, itemId, qty)
       → variation.changeItemQuantity(itemId, qty, tax)
       → item.changeQuantity(qty) + this.recalculate(tax)
```

このチェーンを通れば**必ず最後に recalculate が走る**ことが保証される。

---

### 2. `ReadonlyArray<Readonly<EstimateItem>>` の 2 層構造

```ts
get items(): ReadonlyArray<Readonly<EstimateItem>> {
  return this._items;  // ← 内部配列の参照をそのまま返している
}
```

| 層 | 防ぐもの | このコードでの実効性 |
|---|---|---|
| `ReadonlyArray<…>` | 配列の構造変更（push/splice 等） | ✅ **強力に効く** |
| `Readonly<EstimateItem>` | プロパティへの代入 | ⚠️ ほぼ効かない（フィールドが全部 private なので元々代入不可） |
| `private` フィールド | 外部からのフィールドアクセス全般 | ✅ 効く |
| **バレル + ESLint** | そもそも EstimateItem の参照を持てなくする | ✅ **これが本丸** |

#### `ReadonlyArray` がないと何が壊れるか

```ts
// 仮にこう書いたら…
get items(): EstimateItem[] {
  return this._items;
}

// アプリ層で:
const items = variation.items;
items.push(someItem);  // ← variation の内部配列に直接追加される
items.splice(0, 1);    // ← 削除もできる

variation.subtotal     // ← 古い値のまま
```

`ReadonlyArray<T>` をつけると `push`/`pop`/`splice`/`sort` が型から消えてコンパイルエラーになる。

#### `Readonly<T>` の重大な穴

TypeScript の `Readonly<T>` は**プロパティしか readonly にしない**。**メソッド呼び出しは止めない**:

```ts
const item: Readonly<EstimateItem> = variation.items[0];
item.changeQuantity(...)  // ← 通る！
```

`item.changeQuantity` こそが集約状態を壊す経路なのに、`Readonly` ではそこを防げない。実質的な防衛線は「**バレル非公開 + ESLint で EstimateItem を import 禁止**」。型レベルではなく**到達可能性**で防いでいる。

#### 言語による違い

- **Java**: `Collections.unmodifiableList(items)` — ランタイム保証あり
- **C#**: `IReadOnlyList<T>` — インターフェースで mutator が見えない
- **TypeScript**: `ReadonlyArray<T>` は型保証のみ、メソッドは隠せない

JS/TS では「型保証 + 到達可能性制御」の二段構えが必要。

---

### 3. 集約ルートのメソッド数

Estimate.ts の public mutator は約 23（getter 含むと 40+）:

| カテゴリ | 数 | 内容 |
|---|---|---|
| Variation 管理 | 4 | add/remove/activate/deactivate |
| 明細操作（委譲） | 6 | add/remove/changeItem×4 |
| 割引 | 1 | changeOverallDiscount |
| 税情報 | 2 | changeTaxRate/changeTaxRoundingType |
| サブタイプ詳細 | 4 | attach/detach × Repair/AfterRepair |
| メタ情報 | 6 | estimateDate/deadline/customer 等 |

#### 「メソッド数が多い」のは必然か？

**ほぼ必然** だが、**粒度の選択**で調整可能。

##### 細粒度（このコードベースの選択）

```ts
changeItemQuantity(variationId, itemId, qty)
changeItemUnitPrice(variationId, itemId, price)
changeItemDiscountRate(variationId, itemId, rate)
changeItemDiscount(variationId, itemId, discount)
```

→ 意図が型シグネチャに現れる。

##### 粗粒度（コマンドオブジェクト方式）

```ts
type ItemRevision =
  | { kind: "quantity"; quantity: Quantity }
  | { kind: "unitPrice"; price: Money }
  | { kind: "discountRate"; rate: DiscountRate }
  | { kind: "discount"; discount: Money };

reviseItem(variationId, itemId, revision: ItemRevision): void
```

→ メソッド数は減るが呼び出し側に分岐が寄る。

##### 業務イベント単位（最も DDD らしい）

```ts
applyNegotiatedDiscount(input: {
  variationId,
  itemDiscounts: Map<EstimateItemId, Money>,
  overallDiscount?: Money,
}): void
```

→ ユースケースが固まらないと書けないので時期尚早。

#### このプロジェクトが細粒度を選んだ理由

1. **再計算ロジックの単純化**: 全 mutator で必ず `recalculate` を呼ぶ不変条件を守りやすい
2. **ユースケース未着手**: 粗粒度に最適化するのは尚早。まず細粒度で実装→ユースケース実装時にリファクタする方が安全

#### 「God Object 化」のサインは別

メソッド数そのものより、「**異なる責務が混ざっているか**」が問題:

- ❌ メソッド名が他エンティティの名前を含む（責務漏れ）
- ❌ 同じ集約内で関係のない変更が混ざる
- ❌ 集約をまたぐ整合性保証

**責務の凝集度が高ければメソッド数が多くても God Object ではない**（Evans 本）。

このコードは全メソッドが「見積の状態変更」という単一責務に閉じているので**健全**。

#### Anemic Domain Model との対比

「getter/setter だけのエンティティ + サービス層に全ロジック」のアンチパターンと比べると、メソッドが集約に集まっているのは**正しい兆候**。状態変更ロジックがエンティティ自身に閉じている = 「振る舞い」をモデル化できている。

---

## 学びの要点（短縮版）

1. **集約境界 = 不変条件の責任範囲**。親子関係とは別概念。子エンティティの mutator は集約ルート経由でしか呼ばせない（不変条件の維持のため）
2. **TypeScript の `Readonly<T>` はメソッドを止めない**。実質的な防衛線はバレル + ESLint
3. **集約ルートのメソッド多さは必然**だが、God Object かどうかは「数」ではなく「責務の凝集度」で判定する
4. **細粒度メソッド vs 粗粒度コマンド**は、ユースケースが固まる前は細粒度の方が安全（再計算ロジックを単純に保てる）

---

## 参考

### 関連ファイル

- `src/server/subdomains/estimate/domain/entities/Estimate.ts`
- `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`
- `src/server/subdomains/estimate/domain/entities/EstimateItem.ts`
- `src/server/subdomains/estimate/domain/entities/index.ts` — バレル（公開境界）
- `eslint.config.mjs:54-75, 148-153` — `no-restricted-imports` で境界を構造強制
- `docs/claude-plans/issue-284/estimate-aggregate-and-module-boundary.md` — 設計計画
- `docs/claude-plans/issue-284/deviations.md` — 計画からの逸脱記録

### 関連トピック（未整理）

- リポジトリ実装時に EstimateItem を import する経路（`entities/internal.ts` 案）
- ユースケース層からの呼び出しパターン
- §3.4 申請バリエーション制約をユースケース層で実装する方針
- 防御コピー vs ReadonlyArray の選択基準
