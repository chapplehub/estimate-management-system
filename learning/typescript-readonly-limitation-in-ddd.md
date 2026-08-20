# TypeScript の `Readonly<T>` の穴と DDD 集約境界の守り方

作成日: 2026-06-01

## 概要

TypeScript の `Readonly<T>` 型ユーティリティには「**メソッド呼び出しを止められない**」という重大な穴がある。DDD の集約境界をクラスのメソッド経由で守ろうとする時、Java/C# のように型システムだけでは隔離できない。TypeScript 固有の事情として「**到達可能性（バレル + ESLint）**」で補う必要がある。

## 詳細

### `Readonly<T>` が止めるもの・止めないもの

`Readonly<T>` は T の **プロパティ** を全部 readonly にする型ユーティリティ。

```ts
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};
```

「プロパティ」しか触らないので、**メソッド呼び出しは無傷**:

```ts
class EstimateItem {
  private _quantity: Quantity;

  changeQuantity(newQty: Quantity): void {  // ← mutator method
    this._quantity = newQty;
  }
}

const item: Readonly<EstimateItem> = variation.items[0];
item.changeQuantity(Quantity.of(10));  // ✅ 通る（型エラーにならない）
```

→ `item.changeQuantity` こそが集約の状態を壊す経路なのに、`Readonly` ではそこを防げない。

### なぜそうなるか — TypeScript の型システム上の事情

`Readonly<T>` は `keyof T` で得られる全プロパティ（メソッド含む）に `readonly` 修飾子を付けるが、`readonly` 修飾子の意味は「**そのプロパティへの再代入を禁止する**」だけ。

```ts
item.changeQuantity = someNewFn  // ❌ readonly なのでこれは禁止される
item.changeQuantity(qty)         // ✅ 呼び出しは「再代入」ではないので通る
```

つまり `Readonly<T>` は「**メソッドの参照を差し替えること**」を禁止しているだけで、「**メソッドを呼ぶこと**」自体は許している。

### Java / C# との比較

|  | mutator メソッドを外から呼べないようにする方法 | 効き目 |
|---|---|---|
| **Java** | `Collections.unmodifiableList(list)` を返す。`set/add/remove` を呼ぶと `UnsupportedOperationException` | **ランタイム保証** あり |
| **Java** | `List<T>` → `Iterable<T>` で返す（mutator がインターフェースに無い） | 型保証あり |
| **C#** | `IReadOnlyList<T>` で返す（mutator がインターフェースに無い） | **型保証** あり |
| **TypeScript** | `Readonly<T>` で返す | **無効**（メソッド呼び出しを止められない） |
| **TypeScript** | `ReadonlyArray<T>` で返す | **配列メソッドのみ**型から消える（`push`/`pop`/`splice` 等） |
| **TypeScript** | インターフェースで mutator を露出させない | 型保証あり（ただし `as` でキャスト可能） |

Java/C# は「**read-only 用のインターフェース**」を用意することで mutator を構造的に隠せる。TypeScript はクラス側に mutator メソッドが残ったまま `Readonly<T>` でラップしても、メソッドが見えてしまう。

### TypeScript で集約境界を守る本当の方法

このプロジェクトで実際に効いているのは **`Readonly<T>` ではなく** 以下の組み合わせ:

#### ① バレルから子エンティティを export しない

```ts
// src/server/subdomains/estimate/domain/entities/index.ts
export { Estimate } from "./Estimate";
// ← EstimateItem, EstimateVariation 等は export しない
```

#### ② ESLint で直接 import を禁止

```js
// eslint.config.mjs:58-75
"no-restricted-imports": [
  "error",
  {
    patterns: [{
      group: [
        "@subdomains/estimate/domain/entities/EstimateVariation",
        "@subdomains/estimate/domain/entities/EstimateItem",
        // ...
      ],
      message: "Estimate 集約の子エンティティは集約外から直接 import できません..."
    }]
  }
]
```

#### ③ 集約内（entities/ 配下）は相対 import を許可

```js
// eslint.config.mjs:148-153
{
  files: ["src/server/subdomains/estimate/domain/entities/**"],
  rules: { "no-restricted-imports": "off" }
}
```

→ Estimate.ts や EstimateVariation.ts は子を import できるが、外部コードは EstimateItem の**型・クラス参照そのものを持てない**。

これにより、外部コードが `variation.items[0]` の戻り値を受け取っても、その型は `Readonly<EstimateItem>` だが、そもそも `EstimateItem` を import できないので**変数宣言で型を書けない**し、**`new EstimateItem(...)` もできない**。実用上 `changeQuantity` を直接呼ぶ経路を断てる。

### では `Readonly<T>` を書く意味はあるのか

実効性は低いが書いておく価値はある:

1. **意図表明**: 「ここは触らないでね」というコードレベルのシグナル
2. **将来の保険**: もし EstimateItem に public プロパティを追加してしまった時、`Readonly` がそれだけは止めてくれる
3. **コスト ≒ 0**: 型注釈一つで済むので、効きが弱くても外す理由がない

### 実質の防衛線まとめ

| 層 | 効くもの | 効かないもの |
|---|---|---|
| `private` フィールド | フィールドへの直接アクセス | mutator メソッド呼び出し |
| `Readonly<T>` | プロパティ代入 | mutator メソッド呼び出し |
| `ReadonlyArray<T>` | 配列構造の変更 (push/splice) | 配列内要素のメソッド呼び出し |
| **バレル非公開 + ESLint** | **クラス参照そのものを集約外で持てなくする** | （これが実効的な本丸） |

→ TypeScript の DDD 実装では「**型 + 到達可能性**」の二段構えが必須。

## 学びの要点

1. `Readonly<T>` は**メソッドを止めない**。プロパティ代入を防ぐだけ
2. TypeScript はクラスの public メソッドを型で隠せない（Java/C# のインターフェース分離ができない）
3. DDD 集約境界を構造的に守るには **バレル + ESLint** で「**そもそも子エンティティの参照を持てない**」状態を作る
4. `Readonly<T>` を書く価値はあるが、実効性ではなく**意図表明 + 将来の保険**として位置づける

## 参考

### 関連ファイル

- `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts:356-358` — `items` ゲッターの戻り型
- `src/server/subdomains/estimate/domain/entities/index.ts` — バレル（公開境界）
- `eslint.config.mjs:54-75` — `no-restricted-imports` 本体ルール
- `eslint.config.mjs:148-153` — 集約内オーバーライド（相対 import 許可）

### 関連メモ

- `learning/ddd-estimate-aggregate-design.md` — 本トピックを含む集約設計の包括メモ

### 関連トピック

- TypeScript で「mutator を持つインターフェースと持たないインターフェースの分離」をやりたい場合の選択肢:
  - `interface IEstimateItemReadOnly { get quantity(): Quantity; ... }` 系の分離
  - Branded type による Read 用 / Write 用の型分離
  - 防御コピー（`return [...this._items]`）でランタイム保証
- 上記いずれも本プロジェクトでは未採用（バレル + ESLint で十分と判断）
