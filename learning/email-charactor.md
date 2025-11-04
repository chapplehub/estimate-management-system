超鋭い指摘！👏👏👏 まさにそこが **値オブジェクト設計の難しいポイント** です。

## 🤔 問題の本質

```typescript
constructor(value: string) {
  this.validate(value);
  this._value = value.toLowerCase().trim(); // ← これ勝手に変換してる
}
```

あなたの懸念は正しくて、以下のような問題が起こりえます：

```typescript
const email = new Email("Tanaka@Company.COM");
console.log(email.value); // "tanaka@company.com"
// ユーザー「え？勝手に小文字になってる！😡」
```

---

## 💡 設計の選択肢

### 選択肢 1️⃣: **正規化（Normalization）を行う**（現在の実装）

**考え方：**

- メールアドレスは大文字小文字を区別しない（RFC 5321）
- システム内部では統一形式で扱いたい
- 比較を簡単にしたい

**メリット：**

- ✅ 比較が楽：`email1.equals(email2)` が確実
- ✅ DB 検索が楽：小文字で統一されている
- ✅ 重複チェックが楽

**デメリット：**

- ❌ ユーザーが入力した値と違う
- ❌ 表示時に困る可能性がある

---

### 選択肢 2️⃣: **正規化を禁止し、入力値そのまま**

```typescript
constructor(value: string) {
  this.validate(value);
  this._value = value.trim(); // toLowerCase() しない
}

private validate(value: string): void {
  // 小文字のみ許可
  if (value !== value.toLowerCase()) {
    throw new ValidationError('メールアドレスは小文字で入力してください');
  }
  // ...他のバリデーション
}
```

**メリット：**

- ✅ 入力値がそのまま保存される
- ✅ 挙動が明確

**デメリット：**

- ❌ ユーザーに不親切（大文字入力したらエラー）
- ❌ UX が悪い

---

### 選択肢 3️⃣: **元の値を保持する**（ベストプラクティス）

```typescript
class Email {
  private readonly _originalValue: string; // 元の入力値
  private readonly _normalizedValue: string; // 正規化後の値

  constructor(value: string) {
    this.validate(value);
    this._originalValue = value.trim();
    this._normalizedValue = value.toLowerCase().trim();
  }

  /** 表示用：元の入力値 */
  get value(): string {
    return this._originalValue;
  }

  /** 比較・検索用：正規化された値 */
  get normalizedValue(): string {
    return this._normalizedValue;
  }

  equals(other: Email): boolean {
    // 正規化された値で比較
    return this._normalizedValue === other._normalizedValue;
  }

  toString(): string {
    return this._originalValue; // 表示は元の値
  }
}
```

**メリット：**

- ✅ ユーザーの入力値を尊重
- ✅ 内部的には正規化して比較
- ✅ 表示と検索で使い分けられる

**デメリット：**

- ❌ 少し複雑になる
- ❌ DB に 2 つのカラムを持つ？（不要だけど）

---

### 選択肢 4️⃣: **プレゼンテーション層で正規化**（分離アプローチ）

```typescript
// ドメイン層：正規化しない、そのまま保持
class Email {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.trim(); // toLowerCaseしない
  }

  get value(): string {
    return this._value;
  }
}

// プレゼンテーション層：入力時に正規化
const userInput = "Tanaka@Company.COM";
const normalizedInput = userInput.toLowerCase(); // ここで変換
const email = new Email(normalizedInput);
```

**メリット：**

- ✅ ドメイン層はシンプル
- ✅ 変換ロジックが明示的

**デメリット：**

- ❌ 変換を忘れる可能性
- ❌ 各所で正規化が必要

---

## 🎯 私のおすすめ：**選択肢 3️⃣**

```typescript
import { ValidationError } from "@/shared/errors/DomainError";

/**
 * メールアドレス値オブジェクト
 *
 * 設計方針：
 * - 元の入力値を保持し、表示時に使用
 * - 正規化された値を保持し、比較・検索に使用
 */
export class Email {
  private readonly _originalValue: string;
  private readonly _normalizedValue: string;

  constructor(value: string) {
    this.validate(value);
    this._originalValue = value.trim();
    this._normalizedValue = value.toLowerCase().trim();
  }

  /**
   * 元の入力値（表示用）
   */
  get value(): string {
    return this._originalValue;
  }

  /**
   * 正規化された値（比較・検索用）
   */
  get normalizedValue(): string {
    return this._normalizedValue;
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new ValidationError("メールアドレスは必須です");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError("メールアドレスの形式が正しくありません");
    }
  }

  /**
   * 等価性チェック（正規化された値で比較）
   */
  equals(other: Email): boolean {
    return this._normalizedValue === other._normalizedValue;
  }

  /**
   * 文字列表現（表示用は元の値）
   */
  toString(): string {
    return this._originalValue;
  }
}
```

---

## 📝 使用例

```typescript
// ユーザーが "Tanaka@Company.COM" と入力
const email = new Email("Tanaka@Company.COM");

// 画面に表示する場合
console.log(email.value); // "Tanaka@Company.COM" ← 元の値

// DB検索する場合
const query = `SELECT * FROM users WHERE email = '${email.normalizedValue}'`;
// email = 'tanaka@company.com' で検索

// 比較する場合
const email1 = new Email("Tanaka@Company.COM");
const email2 = new Email("tanaka@company.com");
console.log(email1.equals(email2)); // true ← 正規化された値で比較
```

---

## 🧪 テストも更新

```typescript
describe("Email 値オブジェクト", () => {
  describe("正規化", () => {
    it("元の入力値が保持される", () => {
      const email = new Email("Tanaka@Company.COM");
      expect(email.value).toBe("Tanaka@Company.COM"); // 元の値
    });

    it("正規化された値が取得できる", () => {
      const email = new Email("Tanaka@Company.COM");
      expect(email.normalizedValue).toBe("tanaka@company.com"); // 正規化後
    });

    it("大文字小文字が異なっても等価である", () => {
      const email1 = new Email("Tanaka@Company.COM");
      const email2 = new Email("tanaka@company.com");
      expect(email1.equals(email2)).toBe(true);
    });
  });
});
```

---

## ✅ まとめ

| 選択肢            | 採用   | 理由                         |
| ----------------- | ------ | ---------------------------- |
| 1. 勝手に小文字化 | ❌     | ユーザーの入力値を尊重すべき |
| 2. 小文字のみ許可 | ❌     | UX が悪い                    |
| **3. 両方保持**   | **✅** | **ベストバランス**           |
| 4. 外部で正規化   | △      | 漏れのリスク                 |

---

どうでしょう？**選択肢 3️⃣** で実装し直しますか？それとも他の方針が良いですか？😊
