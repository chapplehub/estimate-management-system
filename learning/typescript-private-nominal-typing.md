# TypeScript の private と nominal typing、ブランドパターンの関係

作成日: 2026-03-25

## 概要

TypeScript は基本的に structural typing（構造的型付け）だが、`private` キーワードを使ったクラスでは nominal typing（名義的型付け）が適用されるケースがある。この性質と、ValueObject のブランドパターンとの関係を整理する。

## 詳細

### private による nominal typing のルール

`private` プロパティを持つクラスは、**宣言元が異なる場合**に限り nominal typing として扱われる。

```typescript
// 別々のクラスで宣言した private -> 別の型（nominal）
class A { private x = 0; }
class B { private x = 0; }
const a: A = new B(); // Error! 別の型

// 同じ基底クラスから継承した private -> 同じ型（structural）
class Base { private x = 0; }
class A extends Base {}
class B extends Base {}
const a: A = new B(); // OK! 区別されない
```

重要なポイント: **継承した `private` は同じ宣言元として扱われるため、サブクラス間の区別には使えない。**

### ValueObject のブランドパターンが必要な理由

ValueObject 基底クラスに単純に `private` プロパティを追加しても、CustomerName と EmployeeName のようなサブクラスは区別されない（同じ宣言元の private を継承しているため）。

現在の実装 `declare private _type: U` は2つの仕組みを組み合わせている：

1. **ジェネリクス `U`**: `ValueObject<string, CustomerName>` と `ValueObject<string, EmployeeName>` で `_type` の型が異なり、構造的に別の型になる
2. **`private` + `declare`**: 外部からのアクセスを防ぎつつ、`declare` により実行時コストゼロ

| アプローチ | サブクラス間の区別 | 実用性 |
|---|---|---|
| 基底クラスに `private` を追加 | No（同じ宣言元） | - |
| 各サブクラスに `private` を直接宣言 | Yes | No（DRYに反する） |
| ブランドパターン (`declare private _type: U`) | Yes | Yes |

### git worktree で発生する nominal typing エラー

tsconfig.json の `include: ["**/*.ts"]` が worktree 内のファイルも拾ってしまうと、同じクラスが2つの異なるパスから読み込まれる。TypeScript はこれを「別の宣言元」と見なし、`private` プロパティを持つクラス間で型の互換性エラーが発生する。

```
worktrees/feat-issue-148/src/.../Service  ≠  src/.../Service
"Types have separate declarations of a private property 'repository'"
```

対策: `tsconfig.json` の `exclude` に `"worktrees"` を追加する。

## 参考

- `src/server/shared/ValueObject.ts` - ブランドパターンの実装
- `tsconfig.json` - exclude 設定
