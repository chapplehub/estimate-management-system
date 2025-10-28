# TypeScriptの`declare`とNominal Typing（名目的型付け）

## 背景: TypeScriptの構造的型付けの問題

TypeScriptは**構造的型付け (Structural Typing)** を採用しているため、型の互換性はその型が持つ構造（プロパティやメソッド）に基づいて判断されます。

### 問題の具体例

```typescript
class CustomerId {
  constructor(public readonly id: string) {}
}

class OrderId {
  constructor(public readonly id: string) {}
}

const log = (customerId: CustomerId) => {
  console.log(customerId.id);
}

log(new OrderId('1')); // ❌ OrderIdを渡してもエラーにならない！
```

**問題点:**
- `CustomerId`と`OrderId`は同じ構造（`id: string`プロパティ）を持つ
- TypeScriptはこれらを**同じ型**とみなす
- 意図しないバグを引き起こす可能性がある（注文IDが顧客IDとして扱われる）

## 解決策: Nominal Typing（名目的型付け）

**Nominal Typing**とは、型の名前（名目）に基づいて型の互換性を判断する仕組みです。C#やJavaなどで採用されています。

TypeScriptには組み込みのNominal Typingはありませんが、**ブランドプロパティ**というテクニックで実現できます。

## ブランドプロパティとは

型ごとに**ユニークなプロパティ**を追加することで、構造的には同じでも型を区別できるようにします。

### 初期の実装: `@ts-expect-error`を使う方法

```typescript
export abstract class ValueObject<T, U> {
  // @ts-expect-error
  private _type: U;
  protected readonly _value: T;
  // ...
}

class CustomerId extends ValueObject<string, "CustomerId"> {}
class OrderId extends ValueObject<string, "OrderId"> {}
```

**`_type`プロパティの役割:**
- `CustomerId`は`_type: "CustomerId"`を持つ
- `OrderId`は`_type: "OrderId"`を持つ
- これにより、構造的には同じでも**型レベルで区別**される

**問題点:**
```
Include a description after the "@ts-expect-error" directive to explain why the @ts-expect-error is necessary.
The description must be 3 characters or longer.
```
ESLintルールで、`@ts-expect-error`には説明コメントが必要というエラーが発生。

## 改善策: `declare`キーワードを使う

**`declare`キーワード**は、「このプロパティは実行時には存在しないが、型情報としてのみ存在する」ことを宣言します。

### 修正後の実装

```typescript
export abstract class ValueObject<T, U> {
  /**
   * ブランドプロパティ: 構造的型付けを回避し、型の誤用を防ぐ
   * このプロパティは実行時には存在せず、コンパイル時の型チェックのみに使用される
   */
  private declare _type: U;
  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);
    this._value = value;
  }
  // ...
}
```

### 使用例

```typescript
type EmployeeIdValue = string;
export class EmployeeId extends ValueObject<EmployeeIdValue, "EmployeeId"> {
  // ...
}

type EmailValue = string;
export class Email extends ValueObject<EmailValue, "Email"> {
  // ...
}

// ✅ 型レベルで区別される
const employeeId = new EmployeeId("EMP000001");
const email = new Email("test@example.com");

function processEmployeeId(id: EmployeeId) {
  // ...
}

processEmployeeId(employeeId); // ✅ OK
processEmployeeId(email);      // ❌ コンパイルエラー！
```

## `declare`キーワードの詳細

### 構文

```typescript
private declare _type: U;
```

### 特徴

1. **実行時には存在しない**
   - コンパイル後のJavaScriptには含まれない
   - メモリオーバーヘッドがゼロ

2. **型情報としてのみ機能**
   - TypeScriptの型チェック時にのみ使用される
   - 実行時の動作には一切影響しない

3. **初期化が不要**
   - `declare`プロパティはコンストラクタで初期化する必要がない
   - `@ts-expect-error`も不要

### コンパイル結果の比較

```typescript
// TypeScript
class Example {
  private declare _type: "Example";
  private value: string;

  constructor(value: string) {
    this.value = value;
  }
}

// ↓ コンパイル後のJavaScript
class Example {
  constructor(value) {
    this.value = value;
    // _typeは存在しない！
  }
}
```

## `@ts-expect-error` vs `declare`

| 項目 | `@ts-expect-error` | `declare` |
|-----|-------------------|-----------|
| ESLintエラー | あり（説明が必要） | なし |
| 意図の明確性 | 低い（エラーを無視している印象） | 高い（型専用と明示） |
| TypeScript標準 | いいえ | はい |
| 実行時の存在 | 初期化しなければ存在しない | 存在しない（明示的） |
| 推奨度 | △ | ✅ |

## まとめ

### TypeScriptでNominal Typingを実現する方法

1. **ブランドプロパティ**を使う
   - 型ごとにユニークなプロパティを追加
   - 構造的には同じでも型レベルで区別

2. **`declare`キーワード**を使う
   - 実行時には存在しないことを明示
   - 型情報としてのみ機能
   - `@ts-expect-error`が不要

3. **ジェネリクス**で柔軟に
   - `ValueObject<T, U>`のように、第2型パラメータでブランドを指定
   - 各値オブジェクトでユニークな文字列リテラル型を指定

### メリット

✅ **型安全性向上**: 異なるドメイン概念を型レベルで区別
✅ **バグの早期発見**: コンパイル時に型の誤用を検出
✅ **実行時オーバーヘッドなし**: `declare`プロパティは実行時に存在しない
✅ **可読性**: コードの意図が明確になる
✅ **リファクタリング安全性**: IDEが型の違いを認識して警告

### DDD（ドメイン駆動設計）との相性

値オブジェクトは「異なるドメイン概念を区別する」という目的を持ちます。Nominal Typingはこの目的を**型レベルで強制**できるため、DDDと非常に相性が良いです。

```typescript
// ❌ プリミティブ型だと混同しやすい
function transfer(fromId: string, toId: string, amount: number) {}

// ✅ 値オブジェクト + Nominal Typingで型安全
function transfer(fromId: CustomerId, toId: CustomerId, amount: Money) {}
```

## 深掘り: `declare`キーワードがエラーにならない理由

### `declare`なしの場合のエラー

```typescript
export abstract class ValueObject<T, U> {
  private _type: U; // ❌ エラー！
  //      ^^^^^
  // Property '_type' has no initializer and is not definitely assigned in the constructor.
  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);
    this._value = value;
    // _type が初期化されていない！
  }
}
```

**エラーの理由:**
- TypeScriptの`strict`モード（特に`strictPropertyInitialization`）が有効
- すべてのプロパティは**コンストラクタで初期化**するか、**宣言時に初期値**を設定する必要がある
- `_type`は初期化されていないため、コンパイルエラーになる

### `declare`の意味と動作

`declare`は「**このプロパティは型情報のみで、実装は提供しない**」とTypeScriptに伝えるキーワードです。

```typescript
private declare _type: U;
```

これは以下を意味します：

1. **実行時には存在しない**
   - JavaScriptにコンパイルされる際、このプロパティは**完全に削除**される
   - メモリ上に存在しない

2. **初期化チェックをスキップ**
   - `declare`がついているプロパティは、TypeScriptの初期化チェックの対象外
   - コンストラクタで初期化しなくてもエラーにならない

3. **型情報としてのみ機能**
   - TypeScriptの型システムでのみ使用される
   - 型チェック時に「このクラスは`_type: U`というプロパティを持っている」と認識される

### `declare`の本来の用途

`declare`は元々、**外部ライブラリの型定義（アンビエント宣言）** のために設計されました：

```typescript
// .d.ts ファイル（型定義ファイル）
declare const jQuery: JQueryStatic;
declare function require(moduleName: string): any;

// これらは実装を持たず、型情報のみを提供
```

クラス内でも使えるため、ブランドプロパティのようなテクニックで活用できます。

## 重要な注意点: コンパイル時 vs 実行時の型安全性

ブランドプロパティによるNominal Typingは、**コンパイル時のみ**機能します。実行時には影響しません。

### コンパイル時（TypeScriptレベル）

```typescript
const employeeId = new EmployeeId("EMP000001");
const email = new Email("test@example.com");

// ❌ TypeScriptがコンパイルエラーを出す
employeeId.equals(email);
// Error: Argument of type 'Email' is not assignable to parameter of type 'ValueObject<string, "EmployeeId">'
```

**なぜエラーになるのか？**

`EmployeeId`クラスの`equals`メソッドの型シグネチャ：

```typescript
class EmployeeId extends ValueObject<string, "EmployeeId"> {
  // 継承されたequalsメソッドの型
  equals(other: ValueObject<string, "EmployeeId">): boolean
  //            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //            第2型パラメータが "EmployeeId" でなければならない
}

class Email extends ValueObject<string, "Email"> {
  // 継承されたequalsメソッドの型
  equals(other: ValueObject<string, "Email">): boolean
  //            ^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //            第2型パラメータが "Email" でなければならない
}
```

`employeeId.equals(email)`を呼ぼうとすると：
- 必要な型: `ValueObject<string, "EmployeeId">`
- 渡された型: `ValueObject<string, "Email">` （Emailのインスタンス）
- `"EmployeeId"` ≠ `"Email"` → **型エラー！**

### 実行時（JavaScriptレベル）

```typescript
// equalsの実装
equals(other: ValueObject<T, U>): boolean {
  return isEqual(this._value, other._value);
  //            ^^^^^^^^^^^^  ^^^^^^^^^^^^
  //            ここだけ比較している
  //            _type は実行時には存在しない！
}
```

**実行時の動作:**

```typescript
const employeeId = new EmployeeId("EMP000001");
const email = new Email("test@example.com");

// ❌ コンパイルエラーになるが...
employeeId.equals(email);

// ✅ 型チェックを無理やり回避すると...
employeeId.equals(email as any);
// → 実行時には動作してしまう！
//    なぜなら、_typeは実行時には存在せず、_valueだけを比較しているから
```

### コンパイル時 vs 実行時の比較

| タイミング | `U`（ブランド）の影響 | 構造的型付けの回避 | 型エラー |
|----------|-------------------|-----------------|---------|
| **コンパイル時** | ✅ 考慮される | ✅ 回避される | ✅ 検出される |
| **実行時** | ❌ 存在しない | ❌ 回避されない | ❌ 検出されない |

### TypeScriptの型システムの限界

**重要な理解:**
- ブランドプロパティ（`U`）は**コンパイル時の型チェック**でのみ機能する
- TypeScriptが「間違った型を渡せない」ように**コンパイル時にエラー**を出す
- 実行時には`_type`は存在せず、`equals`は単に`_value`を比較するだけ
- 型チェックを回避（`as any`など）すれば、実行時には普通に動作してしまう

これがTypeScriptの**型システムの限界**です。TypeScriptは最終的にJavaScriptにコンパイルされるため、**実行時の型安全性は保証できません**。型安全性はあくまで**開発時（コンパイル時）の支援**です。

### 図解: TypeScriptレベル vs JavaScriptレベル

```
TypeScriptレベル（コンパイル時）:
  EmployeeId { _type: "EmployeeId", _value: string }
  Email      { _type: "Email",      _value: string }
  ↑ 異なる型として認識される（_typeが違う）
  ↑ equals(email) はコンパイルエラー

実行時（JavaScript）レベル:
  EmployeeId { _value: "EMP000001" }
  Email      { _value: "test@example.com" }
  ↑ _typeは存在しない（declareで宣言したため）
  ↑ 型チェックを回避すれば実行できてしまう
```

### ベストプラクティス

1. **型チェックを信頼する**
   - `as any`などで型チェックを回避しない
   - TypeScriptの警告を無視しない

2. **実行時の防御は別途実装する**
   - コンパイル時の型チェックに加えて、必要に応じて実行時バリデーションも行う
   - 特に外部から入力を受け取る場合は注意

3. **開発時の恩恵を最大化する**
   - IDEの補完、型エラー検出を活用
   - リファクタリング時の安全性を享受

## 参考

- [TypeScript Handbook - Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
- [Nominal Typing Techniques in TypeScript](https://basarat.gitbook.io/typescript/main-1/nominaltyping)
- [TypeScript Deep Dive - Ambient Declarations](https://basarat.gitbook.io/typescript/type-system/intro)
- Branded Types / Opaque Types パターン
