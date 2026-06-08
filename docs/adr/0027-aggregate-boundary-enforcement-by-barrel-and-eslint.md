# ADR-0027: 集約境界をバレル + ESLint で構造的に強制する

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-06-01 |
| 最終更新日   | 2026-06-06 |

## コンテキスト

Issue #284 で Estimate 集約（ルート Estimate + 子 EstimateVariation + 孫 EstimateItem + 修理詳細群）を実装した。これがプロジェクトで初めての**多階層集約**（子・孫を持つ集約）である。

既存サブドメイン（customer / employee / product / department / delivery-location / role）はフラットな集約（子エンティティなし）だったため、これまで「集約境界をどう構造的に守るか」を ADR にする必要がなかった。今後 Order / Invoice / 仕入見積 等で多階層集約が増えるため、**初回の Estimate でパターンを確定**して以降の集約で同じ仕組みを再利用する必要がある。

集約境界の守り方は「DDD の原則として子エンティティは集約ルート経由でのみ操作する」が、TypeScript では Java/C# のような言語機能だけで担保できない以下の事情がある:

- **`Readonly<T>` はメソッドを止めない**: TypeScript の `Readonly<T>` は**プロパティへの再代入**は禁止するが、`item.changeQuantity(...)` のような**メソッド呼び出し**は素通しする。
- **インターフェース分離が型システム上で完結しない**: Java の `Iterable<T>` や C# の `IReadOnlyList<T>` のように mutator を持たないインターフェースに「フォールバック」して露出させるパターンが TS では弱い（`as` でキャスト可能）。
- **クラスを import した時点で全 public メソッドが見える**: 子エンティティのクラス自体を外部コードが import できると、その時点で mutator メソッドが型上見えてしまう。

つまり TypeScript で集約境界を守るには「**型レベルの制約だけでなく、到達可能性（誰がそのクラスを import できるか）の制約**」を組み合わせる必要がある。

## 検討した選択肢

### A. `Readonly<T>` / `ReadonlyArray<T>` のみで防ぐ（不採用）

```typescript
class Estimate {
  get variations(): ReadonlyArray<Readonly<EstimateVariation>> {
    return this._variations;
  }
}
```

最も軽量。型注釈一つで済む。

**穴**: `Readonly<EstimateVariation>` はメソッド呼び出しを止めない。アプリ層が `estimate.variations[0].changeItemQuantity(...)` を呼べてしまい、集約ルートが知らない間に状態が変わる → 集計の自動再計算 (ADR-0028) が走らず、集約の不変条件が**静かに壊れる**。

### B. 防御コピーで子エンティティを毎回新しく作って返す（不採用）

```typescript
get variations(): ReadonlyArray<EstimateVariation> {
  return this._variations.map((v) => v.cloneForRead());
}
```

ランタイムレベルで完全に隔離できる。

**問題**:
- 集約アクセスのたびに配列＋全子エンティティを複製するコストが大きい
- `cloneForRead()` の実装で「どれが read-only コピーか」を区別する必要があり、複雑化
- そもそも EstimateItem の mutator メソッドはコピー後も呼べてしまう（メソッド呼び出しは止まらない）→ 真の防衛にならない

### C. インターフェース分離（不採用）

```typescript
interface EstimateVariationReadModel {
  readonly id: EstimateVariationId;
  readonly variationNumber: number;
  // mutator メソッドを持たない
}
class EstimateVariation implements EstimateVariationReadModel { ... }

class Estimate {
  get variations(): ReadonlyArray<EstimateVariationReadModel> { ... }
}
```

Java/C# 流の正統。型上 mutator が見えない。

**問題**:
- TS では `as EstimateVariation` で剥がせる（実行時にエラーにならない）
- ReadModel インターフェースを子・孫すべてに用意する必要があり、コード量が増える
- インターフェースとクラスで getter シグネチャを二重管理することになる

### D. バレル非公開 + ESLint で import 禁止（採用）

```typescript
// src/server/subdomains/estimate/domain/entities/index.ts
export { Estimate } from "./Estimate";
// ← EstimateVariation / EstimateItem / 修理詳細群は export しない
```

```javascript
// eslint.config.mjs
"no-restricted-imports": [
  "error",
  {
    patterns: [{
      group: [
        "@subdomains/estimate/domain/entities/EstimateVariation",
        "@subdomains/estimate/domain/entities/EstimateItem",
        "@subdomains/estimate/domain/entities/RepairEstimateDetail",
        "@subdomains/estimate/domain/entities/AfterRepairEstimateDetail",
        "@subdomains/estimate/domain/entities/RevisedEstimateItemDetail",
      ],
      message: "Estimate 集約の子エンティティは集約外から直接 import できません。集約ルート Estimate（@subdomains/estimate/domain/entities）経由で操作してください。",
    }],
  },
],

// 集約内（entities/ 配下）は相対 import を許可する
{
  files: ["src/server/subdomains/estimate/domain/entities/**"],
  rules: { "no-restricted-imports": "off" },
},
```

子エンティティの**クラス参照そのものを集約外で持てなくする**ことで、mutator メソッドへの到達経路を断つ。

集約内（同 entities/ ディレクトリ）はオーバーライドで相対 import を許可するため、Estimate.ts や EstimateVariation.ts は子を自由に import できる。テストは entities/ 内の `__tests__/` から相対 import で書ける。

## 決定

集約境界は以下の 3 点セットで構造的に強制する:

1. **集約バレル `entities/index.ts` から集約ルートのみ export する**（子エンティティは export しない）
2. **ESLint `no-restricted-imports` で子エンティティの絶対パス import を禁止する**
3. **`entities/**` ディレクトリ配下はオーバーライドで `no-restricted-imports` を off にし、集約内の相対 import を許可する**

これに加え、**getter の戻り型は `ReadonlyArray<Readonly<T>>` 形式とする**（型レベルでも意図を表明する。実効性は補助的だが、コスト ≒ 0 のため省略しない）。

## 根拠

### TypeScript 固有の事情を直視

Java/C# の DDD 例（Evans 本、Vernon Red Book）では「mutator を持たないインターフェースで露出する」パターンが当たり前だが、TypeScript の型システムでは同等の隔離が完結しない。**型保証だけで集約境界を守ろうとすると必ず穴が残る**。到達可能性で補うのが現実解。

### 「クラス参照を持たせない」のが最も強い隔離

ESLint で `import` を禁止すれば、集約外コードは:
- `EstimateItem` を型注釈に書けない
- `new EstimateItem(...)` できない
- ジェネリクスの型パラメータに使えない

唯一の経路は `estimate.variations[0].items[0]` のようにゲッター経由で取得することだが、その型は `Readonly<EstimateItem>` であり、import していないため**変数として保持しづらい**。仮に保持しても mutator 呼び出しに到達するハードルが上がる（後述「影響」参照）。

### 集約内の生産性を犠牲にしない

オーバーライドで `entities/**` 配下を除外することで、Estimate.ts は EstimateVariation を、EstimateVariation.ts は EstimateItem を、それぞれ通常通り import できる。**境界規約は外部に対してだけ強い**。集約内部の実装の自由度は維持される。

### ランタイムコストゼロ

ESLint はビルド時のみ動作し、ランタイムには影響しない。防御コピー（選択肢 B）のような実行時オーバーヘッドが発生しない。

### 不採用理由まとめ

- **A（`Readonly<T>` のみ）**: メソッド呼び出しを止められず、集約の不変条件が壊れる経路が残る
- **B（防御コピー）**: 実行時コストが高く、しかも mutator 呼び出しは結局止まらない
- **C（インターフェース分離）**: `as` で剥がせて穴がある + コード量が増える

## 影響

### 全集約に適用する

今後実装する全集約（Order / Invoice / 仕入見積 等）で本パターンを採用する。サブドメインごとに `entities/index.ts` を用意し、集約ルートのみ export、ESLint で子エンティティを禁止リストに追加する。

### 集約ルートに「明細委譲メソッド群」を実装する責務が発生する

子エンティティを外から直接操作できない以上、子の mutator を呼びたい場合は集約ルートに委譲メソッドを書く必要がある（例: `Estimate.changeItemQuantity(variationId, itemId, qty)`）。これは集約ルートのメソッド数を増やすが、**ADR-0028 の自動再計算と組み合わせて初めて「集約状態が常に整合する」ことを保証**できる。

### `entities/` ディレクトリ運用ルール

- バレル `entities/index.ts` には集約ルートのみ書く
- 子エンティティのクラスは `entities/` 直下のファイルに置く（バレルから export しないだけで、ファイル配置は通常通り）
- テストは `entities/__tests__/` 配下に置く（オーバーライドが効く）

### リポジトリ実装時の例外経路（次イシュー以降の課題）

Prisma → Domain のマッピング時に、リポジトリは子エンティティを構築する必要がある（`EstimateItem.reconstruct(...)` の呼び出し）。これは集約外コードだが**例外的に**子エンティティへのアクセスを必要とする。

選択肢:
- (a) リポジトリを `entities/` 配下に置く（DDD レイヤリング違反）
- (b) `entities/internal.ts` のような**内部用バレル**を用意し、リポジトリだけにアクセス許可するパス制限ルールを追加
- (c) 集約ルートに `reconstructAggregate(snapshot)` のような静的ファクトリを用意し、リポジトリはルートに丸投げ

**この決定は本 ADR のスコープ外**。リポジトリ実装イシュー（着手順序 #5）で判断する。

> **追記（2026-06-06）**: 集約外からの子エンティティ構築は、性質の異なる 2 サブケースに
> 分かれ、それぞれ別 ADR で決定済みである。
> - **再構築（reconstitution）**: Mapper 限定の ESLint 単一ファイルオーバーライドで開ける
>   → **ADR-0031**
> - **新規生成（create）**: 集約内ドメインファクトリ（`EstimateFactory`）経由とし、ESLint
>   例外を増やさない → **ADR-0036**

### `ReadonlyArray<Readonly<T>>` の役割

実効性は本 ADR の到達可能性制御が本丸であり、型注釈は**意図表明 + 将来の保険**として残す:
- 配列構造の変更（push / splice）は `ReadonlyArray<T>` で型上禁止される
- 将来 子エンティティに public プロパティが追加されてしまった場合、`Readonly<T>` がそれだけは止める

### 関連

- `src/server/subdomains/estimate/domain/entities/index.ts` — 本パターンの実装例
- `eslint.config.mjs:54-75, 148-153` — ESLint 設定
- ADR-0028 — 自動再計算（本 ADR と組み合わせて集約不変条件を守る）
- ADR-0031 — 集約再構築の例外経路（外部構築の reconstitution サブケース）
- ADR-0036 — 集約外からの新規集約生成（外部構築の create サブケース）
- ADR-0019 — VarChar / CHECK 制約（同じく「型システム単独では足りない不変条件を別の仕組みで補う」発想）
