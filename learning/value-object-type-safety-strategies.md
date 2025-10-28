# Value Object の型安全性戦略

## 概要

Value Object の `equals` メソッドにおける型安全性を確保する2つのアプローチと、それらを組み合わせた多重防御戦略についてまとめる。

## 問題の背景

TypeScript は**構造的型付け（Structural Typing）**を採用しているため、以下のような問題が発生する：

```typescript
class EmployeeId extends ValueObject<string> { }
class MailAddress extends ValueObject<string> { }

const empId = new EmployeeId("EMP000001");
const mail = new MailAddress("EMP000001");

// 構造が同じなので、TypeScriptは同じ型として扱う可能性がある
empId.equals(mail);  // ドメイン的には誤りだが...
```

異なるドメイン概念（社員番号とメールアドレス）が、構造が同じという理由で等価と判定されるのは**ドメインの整合性を損なう**。

## 解決策1: ブランドプロパティ（Branded Types）

### 実装

```typescript
export abstract class ValueObject<T, U> {
  // コンパイル時のみ存在する型ブランド
  private declare _type: U;
  protected readonly _value: T;

  equals(other: ValueObject<T, U>): boolean {
    return isEqual(this._value, other._value);
  }
}

// 使用例
class EmployeeId extends ValueObject<string, "EmployeeId"> { }
class MailAddress extends ValueObject<string, "MailAddress"> { }
```

### 仕組み

- `declare` キーワード：実行時には存在せず、型チェック時のみ使用される
- 第2型パラメータ `U` がクラスごとに異なるリテラル型（"EmployeeId", "MailAddress"）
- TypeScript が型システム上で異なる型として認識

### 利点

- ✅ **コンパイル時の型安全性**：開発中にエディタでエラー表示
- ✅ **ゼロコスト抽象化**：実行時のパフォーマンスオーバーヘッドなし
- ✅ **型推論の強化**：TypeScriptの型システムを最大限活用

### 欠点

- ❌ **実行時の保護がない**：型アサーション（`as any`）で回避可能
- ❌ **動的データに対応できない**：JSON.parse、API レスポンスなど

### 検出できるエラー

```typescript
const empId = new EmployeeId("EMP000001");
const mail = new MailAddress("test@example.com");

// ✅ コンパイルエラーで検出
empId.equals(mail);
// Error: Argument of type 'MailAddress' is not assignable to
// parameter of type 'ValueObject<string, "EmployeeId">'

// ❌ 検出できない（型システムを回避）
(empId as any).equals(mail);  // コンパイルは通る
```

## 解決策2: constructor.name チェック

### 実装

```typescript
export abstract class ValueObject<T> {
  readonly value: T;

  equals(other: ValueObject<T>): boolean {
    return (
      other.constructor.name === this.constructor.name &&
      other.value === this.value
    );
  }
}
```

### 仕組み

- `constructor.name` でクラス名を文字列として取得
- 実行時に異なるクラスのインスタンスを判別
- JavaScript レベルでの型チェック

### 利点

- ✅ **実行時の型安全性**：どんな方法でも型を回避できない
- ✅ **動的データに対応**：JSON、API、any型でも正しく判定
- ✅ **シンプル**：ブランド型パラメータ不要

### 欠点

- ❌ **コンパイル時チェックなし**：エディタで警告されない
- ❌ **実行時オーバーヘッド**：文字列比較のコスト（軽微）
- ⚠️ **minification のリスク**：ビルドツールでクラス名が変わる可能性

### 検出できるエラー

```typescript
const empId = new EmployeeId("EMP000001");
const mail = new MailAddress("test@example.com");

// ❌ コンパイルエラーにならない（型システムが検出できない）
empId.equals(mail);

// ✅ 実行時に false を返す（正しく判定）
(empId as any).equals(mail);  // false
```

## コンパイル時 vs 実行時の型安全性

### TypeScript の実行フロー

```
TypeScript コード
      ↓
[コンパイル時] TypeScript Compiler が型チェック
      ↓
JavaScript コード（型情報は完全に消える）
      ↓
[実行時] JavaScript エンジンがコードを実行
```

### コンパイル時の型安全性

**タイミング**：コード記述時・ビルド時

**適用範囲**：型が明示的に書かれている部分

```typescript
// ✅ コンパイル時に検出可能
const empId: EmployeeId = new EmployeeId("EMP000001");
const mail: MailAddress = new MailAddress("test@example.com");

empId.equals(mail);  // ❌ コンパイルエラー！
```

**検出できるエラー**：
- 明示的な型の不一致
- 関数の引数の型違い
- 存在しないプロパティへのアクセス

### 実行時の型安全性

**タイミング**：プログラム実行時

**適用範囲**：型情報が失われた場面、動的な値

```typescript
// ❌ コンパイル時に検出不可能
// ✅ 実行時ガードで防げる

// 1. 外部APIからのデータ
const response = await fetch('/api/user');
const data = await response.json();  // any型
empId.equals(data);  // 実行時に false

// 2. 型アサーション
const obj = someValue as EmployeeId;
empId.equals(obj);  // 実行時にチェック

// 3. JSON.parse
const parsed = JSON.parse('{"value": "EMP000001"}');
empId.equals(parsed);  // 実行時にチェック
```

### シナリオ別対応表

| シナリオ | コンパイル時ガード | 実行時ガード |
|---------|------------------|--------------|
| 型が明示的なコード | ✅ 検出 | - |
| 外部API/JSONデータ | ❌ 未検出 | ✅ 検出 |
| any型の使用 | ❌ 未検出 | ✅ 検出 |
| 型アサーション (as) | ❌ 未検出 | ✅ 検出 |
| サードパーティライブラリ | ❌ 未検出 | ✅ 検出 |
| 動的に生成されたオブジェクト | ❌ 未検出 | ✅ 検出 |

## ベストプラクティス：多重防御戦略

### 推奨実装

両方のアプローチを組み合わせる：

```typescript
export abstract class ValueObject<T, U> {
  // コンパイル時ガード
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
    // 実行時ガード：異なるクラスを確実に判別
    if (other.constructor.name !== this.constructor.name) {
      return false;
    }
    // 値の比較
    return isEqual(this._value, other._value);
  }
}
```

### 効果の比較

| | ブランドのみ | constructor.name のみ | **両方** |
|---|---|---|---|
| コンパイル時の保護 | ✅ | ❌ | ✅ |
| 実行時の保護 | ❌ | ✅ | ✅ |
| パフォーマンス | 最高 | 良好 | 良好 |
| 開発体験 | 良好 | 普通 | 良好 |
| 堅牢性 | 中 | 中 | **高** |

### なぜ両方必要か

```typescript
// コンパイル時ガード：開発時のミスを防ぐ
const empId = new EmployeeId("EMP000001");
const mail = new MailAddress("test@example.com");
empId.equals(mail);  // ❌ エディタで即座にエラー表示

// 実行時ガード：実行時の動的データを防ぐ
async function handleApiData(data: any) {
  const empId = new EmployeeId("EMP000001");
  empId.equals(data);  // ✅ 実行時に false（安全）
}
```

## 実装例：現在のプロジェクト

### 修正前（ValueObject.ts）

```typescript
export abstract class ValueObject<T, U> {
  private declare _type: U;
  protected readonly _value: T;

  equals(other: ValueObject<T, U>): boolean {
    return isEqual(this._value, other._value);  // 実行時チェックなし
  }
}
```

**問題点**：型システムを回避されると誤判定する可能性

### 修正後（推奨）

```typescript
export abstract class ValueObject<T, U> {
  private declare _type: U;
  protected readonly _value: T;

  equals(other: ValueObject<T, U>): boolean {
    // 実行時ガードを追加
    if (other.constructor.name !== this.constructor.name) {
      return false;
    }
    return isEqual(this._value, other._value);
  }
}
```

**改善点**：
- コンパイル時の型安全性を維持
- 実行時の型安全性を追加
- パフォーマンスへの影響は軽微
- テストケース（EmplyeeIdMailAddress.test.ts）が正しく動作

## まとめ

### 重要なポイント

1. **TypeScript の型情報はコンパイル後に消える**
   - コンパイル時チェックだけでは不十分

2. **構造的型付けの限界**
   - 同じ構造の異なるドメイン概念を区別できない

3. **多重防御が最善**
   - ブランドプロパティ：開発時のミスを防ぐ
   - constructor.name：実行時の動的データを防ぐ

4. **ゼロコストではない場合も対策が必要**
   - わずかな実行時コストで、ドメインの整合性を守る価値がある

### 単独で選ぶ場合の指針

- **TypeScript 中心の開発、型が明示的** → ブランドプロパティ
- **実行時の堅牢性重視、外部データ多い** → constructor.name
- **プロダクション環境** → **両方を組み合わせる**

### DDD における意義

Value Object の等価性は**ドメインの中核概念**。異なるドメイン概念が誤って等価と判定されることは、ドメインモデルの整合性を根本から損なう。技術的な制約（構造的型付け）を補完し、ドメインの意図を正しく実装することが重要。
