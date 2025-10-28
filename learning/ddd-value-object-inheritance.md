# Value Objectの継承は適切か - アンチパターンの判断基準

## 議論の背景

`EmployeeId`や`MailAddress`などのValue Objectが`ValueObject`抽象クラスを継承している理由は、主に`equals`メソッドの共通化。

**疑問点:**
> スーパークラスのメソッドをそのまま使いたいという理由で継承をするのはアンチパターンと聞いた。この場合もそのアンチパターンになるか？

**結論:** この場合はアンチパターンではない。

## なぜアンチパターンではないのか

### 1. 概念的な継承（IS-A関係）が成り立つ

```
EmployeeId IS-A ValueObject ✅ 正しい関係性
```

EmployeeIdは概念的に「Value Object」である。これは実装の都合だけでなく、ドメインモデルの観点からも正しい関係性。

### 2. equalsはValue Objectの本質的な振る舞い

Value Objectの定義には「**値による等価性（Value Equality）**」が含まれる：

- `equals`メソッドは、Value Objectという概念に固有の振る舞い
- 単なるユーティリティメソッドではない
- Value Objectであれば必ず持つべき責務

つまり、「たまたまメソッドが共通だから継承する」のではなく、「Value Objectだから当然equalsを持つ」という関係。

## アンチパターンとなる継承の例

### ❌ メソッドの再利用のためだけの継承

```typescript
class Logger {
  log(message: string) {
    console.log(message);
  }
}

// ❌ Userは概念的にLoggerではない
// ただlog()メソッドを使いたいだけ
class User extends Logger {
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  greet() {
    this.log(`Hello, ${this.name}`); // log()を使いたいだけ
  }
}

// User IS-A Logger? → NO! (概念的に誤り)
```

**問題点:**
- UserはLoggerではない（IS-A関係が成り立たない）
- ただ`log()`メソッドを再利用したいだけ
- これが「メソッドの再利用のためだけの継承」というアンチパターン

**正しい設計（コンポジション）:**

```typescript
class Logger {
  log(message: string) {
    console.log(message);
  }
}

// ✅ UserはLoggerを「持つ」（HAS-A関係）
class User {
  private logger: Logger;
  name: string;

  constructor(name: string, logger: Logger) {
    this.name = name;
    this.logger = logger; // 委譲
  }

  greet() {
    this.logger.log(`Hello, ${this.name}`);
  }
}
```

## 現在のValueObject設計の利点

```typescript
export abstract class ValueObject<T, U> {
  // Nominal Typing - ブランド型で型の誤用を防ぐ
  private declare _type: U;

  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);  // Template Method Pattern
    this._value = value;
  }

  // サブクラスに実装を強制
  protected abstract validate(value: T): void;

  // Value Objectの本質的な振る舞い
  equals(other: ValueObject<T, U>): boolean {
    return isEqual(this._value, other._value);
  }
}
```

**この設計が実現すること:**

1. **Template Method Pattern** - コンストラクタで`validate()`を呼び出し、検証ロジックはサブクラスに委譲
2. **Nominal Typing** - `_type`でブランド型を実現し、型の誤用を防ぐ
3. **共通の振る舞い** - `equals`を全Value Objectで統一し、値による等価性を保証
4. **不変性の強制** - `readonly`で値の変更を防ぐ

## 代替アプローチとの比較

### オプション1: 継承（現在の設計）✅ 推奨

```typescript
class EmployeeId extends ValueObject<string, "EmployeeId"> {
  protected validate(value: string): void {
    // バリデーションロジック
  }
}
```

**メリット:**
- コードが簡潔で明確
- DDDの標準パターン
- 型安全性が高い
- Value Objectの概念を型で表現

### オプション2: コンポジション

```typescript
class EmployeeId {
  private valueObject: ValueObjectImpl<string>;

  equals(other: EmployeeId): boolean {
    return this.valueObject.equals(other.valueObject);
  }
}
```

**デメリット:**
- 冗長（ラッパーメソッドが必要）
- Value Objectという概念が型に現れない
- 毎回委譲コードを書く必要がある

### オプション3: ユーティリティ関数

```typescript
class EmployeeId {
  private readonly _value: string;

  equals(other: EmployeeId): boolean {
    return valueObjectEquals(this._value, other._value);
  }
}
```

**デメリット:**
- 型安全性が低い
- 各クラスで`equals`を実装する必要がある
- 統一性がない（実装忘れのリスク）

## 継承を使うべきか判断する基準

### ✅ 継承が適切な場合

1. **IS-A関係が成り立つ**
   - `EmployeeId IS-A ValueObject` → 正しい
   - サブクラスは親クラスの特殊化

2. **共通化するものが本質的な振る舞い**
   - `equals`はValue Objectの本質
   - 単なるユーティリティではない

3. **リスコフの置換原則を満たす**
   - サブクラスは親クラスと置き換え可能

### ❌ 継承が不適切な場合（コンポジションを使う）

1. **IS-A関係が成り立たない**
   - `User IS-A Logger` → 誤り
   - 単にメソッドを使いたいだけ

2. **HAS-A関係（所有）の方が自然**
   - `User HAS-A Logger` → 正しい

3. **複数の機能を組み合わせたい**
   - 多重継承できないTypeScriptでは継承は不向き

## まとめ

**Value Objectの継承は適切な設計パターン:**

- ✅ 概念的に正しい継承（IS-A関係が成り立つ）
- ✅ DDDの標準的なパターン
- ✅ Value Objectの本質的な振る舞い（equals）の共有
- ✅ Template Method Patternの適切な使用
- ✅ Nominal Typingとの組み合わせで型安全性を実現

**アンチパターンとなる継承:**

- ❌ IS-A関係が成り立たない
- ❌ 単にメソッドを再利用したいだけ
- ❌ HAS-A関係の方が自然な場合

**判断のポイント:**

「そのクラスは概念的に親クラスの一種であるか？」を自問する。YESなら継承、NOならコンポジション。
