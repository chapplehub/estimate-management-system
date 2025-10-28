# Value Object: 単一値 vs 複数プロパティの設計

## 問題提起

現在の`ValueObject`基底クラスは単一の`_value: T`プロパティを前提としている：

```typescript
export abstract class ValueObject<T, U> {
  private declare _type: U;
  protected readonly _value: T;  // 単一プロパティ前提

  equals(other: ValueObject<T, U>): boolean {
    return isEqual(this._value, other._value);
  }
}
```

**疑問点:**
> 金額（Money）のように複数プロパティ（金額+通貨）を持つValue Objectを作りたい場合、このequalsでの比較ができなくなるのでは？

## 問題の具体例

### 単一値Value Object（現在の設計で対応可能）

```typescript
// ✅ 単一プロパティなので問題なし
class EmployeeId extends ValueObject<string, "EmployeeId"> {
  // equalsは自動的に提供される
}

class Currency extends ValueObject<string, "Currency"> {
  // "JPY", "USD" などの通貨コード
}
```

### 複数プロパティValue Object（現在の設計では困難）

```typescript
// ❌ 現在の ValueObject では表現が難しい
class Money {
  private readonly amount: number;      // 金額
  private readonly currency: Currency;  // 通貨（これ自体もValue Object）

  equals(other: Money): boolean {
    // 両方のプロパティを比較する必要がある
    return this.amount === other.amount &&
           this.currency.equals(other.currency);
  }
}
```

金額と通貨の**両方**が等しい場合のみ、同じ金額として扱うべき：
- `Money(100, JPY)` ≠ `Money(100, USD)` → 異なる
- `Money(100, JPY)` = `Money(100, JPY)` → 同じ

## 設計オプション

### オプション1: 単一値専用と割り切る（推奨・現状維持）

```typescript
// 単一値Value Object → ValueObjectを継承
class EmployeeId extends ValueObject<string, "EmployeeId"> { }
class Currency extends ValueObject<string, "Currency"> { }

// 複数プロパティValue Object → 継承しない、個別実装
class Money {
  private readonly _amount: number;
  private readonly _currency: Currency;

  constructor(amount: number, currency: Currency) {
    this.validate(amount, currency);
    this._amount = amount;
    this._currency = currency;
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): Currency {
    return this._currency;
  }

  equals(other: Money): boolean {
    return this._amount === other._amount &&
           this._currency.equals(other._currency);
  }

  private validate(amount: number, currency: Currency): void {
    if (amount < 0) {
      throw new ValidationError("金額は0以上である必要があります");
    }
    // 小数点以下の桁数チェックなど
  }
}
```

**メリット:**
- シンプルで理解しやすい
- 単一値Value Objectには最適（多くのケースで十分）
- 過度な抽象化を避けられる

**デメリット:**
- 複数プロパティValue Objectでは`equals`を毎回実装する必要がある
- ただし`isEqual(this, other)`を使えば簡潔

**適用場面:**
- 現時点では複数プロパティValue Objectが少ない
- 将来的に増えたら再検討

### オプション2: equalsを抽象メソッドにする

```typescript
export abstract class ValueObject<U> {
  private declare _type: U;

  constructor() {
    this.validate();
  }

  protected abstract validate(): void;

  // equalsを抽象メソッドに（実装を強制するだけ）
  abstract equals(other: ValueObject<U>): boolean;
}
```

**使用例:**
```typescript
class EmployeeId extends ValueObject<"EmployeeId"> {
  private readonly _value: string;

  constructor(value: string) {
    super();
    this._value = value.toUpperCase().trim();
  }

  protected validate(): void {
    // バリデーション
  }

  equals(other: EmployeeId): boolean {
    return this._value === other._value;
  }
}

class Money extends ValueObject<"Money"> {
  private readonly _amount: number;
  private readonly _currency: Currency;

  constructor(amount: number, currency: Currency) {
    super();
    this._amount = amount;
    this._currency = currency;
  }

  protected validate(): void {
    if (this._amount < 0) throw new ValidationError("...");
  }

  equals(other: Money): boolean {
    return this._amount === other._amount &&
           this._currency.equals(other._currency);
  }
}
```

**メリット:**
- 柔軟性が高い
- 単一値・複数プロパティ両方に対応可能
- Value Objectであることを型で表現

**デメリット:**
- 基底クラスの利点が減る（equalsの実装を強制するだけ）
- 単純な単一値の場合も毎回equalsを書く必要がある
- ボイラープレートが増える

### オプション3: 2つの基底クラスを用意する

```typescript
// 単一値Value Object用
export abstract class SingleValueObject<T, U> {
  private declare _type: U;
  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);
    this._value = value;
  }

  protected abstract validate(value: T): void;

  get value(): T {
    return this._value;
  }

  equals(other: SingleValueObject<T, U>): boolean {
    return isEqual(this._value, other._value);
  }
}

// 複数プロパティValue Object用
export abstract class MultiValueObject<U> {
  private declare _type: U;

  constructor() {
    this.validate();
  }

  protected abstract validate(): void;

  // equalsは各サブクラスで実装
  abstract equals(other: MultiValueObject<U>): boolean;
}
```

**使用例:**
```typescript
class EmployeeId extends SingleValueObject<string, "EmployeeId"> {
  // equalsは自動的に提供される
  protected validate(value: string): void { /* ... */ }
}

class Money extends MultiValueObject<"Money"> {
  private readonly _amount: number;
  private readonly _currency: Currency;

  constructor(amount: number, currency: Currency) {
    super();
    this._amount = amount;
    this._currency = currency;
  }

  protected validate(): void { /* ... */ }

  equals(other: Money): boolean {
    return this._amount === other._amount &&
           this._currency.equals(other._currency);
  }
}
```

**メリット:**
- それぞれの用途に最適化
- 単一値は簡潔、複数プロパティは柔軟
- 意図が明確

**デメリット:**
- 基底クラスが2つに増える
- どちらを使うか判断が必要
- やや複雑

### オプション4: Tをオブジェクト型にする（非推奨）

```typescript
class Money extends ValueObject<{ amount: number; currency: Currency }, "Money"> {
  constructor(amount: number, currency: Currency) {
    super({ amount, currency });
  }

  get amount(): number {
    return this._value.amount;
  }

  get currency(): Currency {
    return this._value.currency;
  }

  protected validate(value: { amount: number; currency: Currency }): void {
    if (value.amount < 0) {
      throw new ValidationError("金額は0以上である必要があります");
    }
  }
}
```

**メリット:**
- 現在の設計を変更しない

**デメリット:**
- 不自然（内部的にオブジェクトをラップしている）
- バリデーションが複雑になる
- 可読性が低い
- コンストラクタで一度オブジェクトを作る無駄

## DDDにおける実践的なアプローチ

実は、**多くのDDD実践者は共通基底クラスを必須とは考えていない**：

### Martin Fowlerの見解

- Value Objectに必ず基底クラスが必要とは言及していない
- `equals`は各Value Objectの責務として個別に実装するのが一般的
- 共通基底クラスはあくまで「便利なユーティリティ」

### TypeScriptでの簡潔な実装

`isEqual`（es-toolkitやlodash）は深い比較をサポートしているため：

```typescript
import { isEqual } from "es-toolkit/compat";

class Money {
  private readonly _amount: number;
  private readonly _currency: Currency;

  equals(other: Money): boolean {
    // isEqualは再帰的にすべてのプロパティを比較してくれる
    return isEqual(this, other);
  }
}
```

このように、基底クラスなしでも簡潔に書ける。

**ただし注意点:**
- `isEqual(this, other)`は全プロパティを比較する
- 意図しないプロパティ（メタデータなど）も比較対象になる可能性
- 明示的な比較の方が意図が明確な場合もある：

```typescript
equals(other: Money): boolean {
  // 明示的に比較対象を指定（推奨）
  return this._amount === other._amount &&
         this._currency.equals(other._currency);
}
```

## 推奨アプローチ（現時点）

**オプション1（現状維持）を推奨:**

### 1. 現在の`ValueObject`は単一値専用として維持

```typescript
// web/src/shared/ValueObject.ts
export abstract class ValueObject<T, U> {
  private declare _type: U;
  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);
    this._value = value;
  }

  protected abstract validate(value: T): void;

  get value(): T {
    return this._value;
  }

  equals(other: ValueObject<T, U>): boolean {
    return isEqual(this._value, other._value);
  }
}
```

**適用例:**
- `EmployeeId` - 社員番号（文字列）
- `MailAddress` - メールアドレス（文字列）
- `Currency` - 通貨コード（文字列）
- `PhoneNumber` - 電話番号（文字列）

### 2. 複数プロパティValue Objectは個別実装

```typescript
// web/src/domain/valueObjects/Money.ts
export class Money {
  private readonly _amount: number;
  private readonly _currency: Currency;

  constructor(amount: number, currency: Currency) {
    this.validate(amount);
    this._amount = amount;
    this._currency = currency;
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): Currency {
    return this._currency;
  }

  private validate(amount: number): void {
    if (amount < 0) {
      throw new ValidationError("金額は0以上である必要があります");
    }
    // 小数点桁数チェックなど
  }

  equals(other: Money): boolean {
    return this._amount === other._amount &&
           this._currency.equals(other._currency);
  }

  // ドメインロジック
  add(other: Money): Money {
    if (!this._currency.equals(other._currency)) {
      throw new BusinessRuleViolationError("異なる通貨同士は加算できません");
    }
    return new Money(this._amount + other._amount, this._currency);
  }
}
```

**理由:**
- `equals`は`isEqual()`またはプロパティごとの比較で簡潔に書ける
- 過度な抽象化を避け、必要な場所で必要な実装をする
- シンプルで理解しやすい

### 3. 将来的に複数プロパティValue Objectが増えたら再検討

以下の状況になったら設計を見直す：

- 複数プロパティValue Objectが5個以上になった
- `equals`のボイラープレートが問題になってきた
- チーム内で共通パターンの必要性が認識された

その時点で：
- `MultiValueObject`基底クラスを追加（オプション3）
- または`equals`を抽象メソッドにする設計に変更（オプション2）

## 設計判断のガイドライン

### 単一値Value Object → `ValueObject`を継承

```typescript
class EmployeeId extends ValueObject<string, "EmployeeId"> { }
```

**判断基準:**
- プロパティが1つだけ
- `equals`の実装が自明（値の比較のみ）

### 複数プロパティValue Object → 個別実装

```typescript
class Money {
  private readonly _amount: number;
  private readonly _currency: Currency;
  // equals, その他メソッド
}
```

**判断基準:**
- プロパティが2つ以上
- `equals`の実装に複数プロパティの比較が必要
- ドメインロジックが複雑（Money.add()など）

## まとめ

**現在の`ValueObject`基底クラスの特性:**

- ✅ 単一値Value Objectに最適化されている
- ✅ Template Method Patternで検証を統一
- ✅ Nominal Typingで型安全性を実現
- ⚠️ 複数プロパティValue Objectには向かない

**複数プロパティValue Objectへの対応:**

- ✅ 個別実装で十分対応可能
- ✅ `equals`は明示的なプロパティ比較またはisEqual()で簡潔
- ✅ 過度な抽象化を避け、シンプルさを保つ
- ⏳ 将来的に必要になったら基底クラスを追加検討

**重要な原則:**

> "YAGNI (You Aren't Gonna Need It)" - 必要になるまで抽象化しない

現時点では単一値Value Objectが主流。複数プロパティValue Objectが実際に必要になり、パターンが明確になった時点で共通化を検討する方が、過度な設計を避けられる。
