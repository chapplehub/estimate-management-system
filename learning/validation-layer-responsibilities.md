# バリデーション層の責務分担：プレゼンテーション層(Zod) vs ドメイン層

## 概要

DDD と Web アプリケーションを組み合わせる際、Zod とドメイン層のバリデーションが重複するように見える問題について整理した。結論として、**各層には明確な役割の違いがあり、重複ではなく責務分担**である。

## 疑問の背景

### 当初の疑問

```typescript
// Zodスキーマ (schema.ts)
email: z.string().email("有効なメールアドレスを入力してください");

// ドメイン層 (Email.ts)
export class Email {
  constructor(value: string) {
    if (!this.isValidEmail(value)) {
      throw new ValidationError("有効なメールアドレスではありません");
    }
  }
}
```

→ **同じことを 2 回書いている？Zod は不要では？**

### 誤解していた考え方

- Presentation 層（Zod）でドメイン層と**同じバリデーションチェック**を入れないといけない
- Zod のバリデーションとドメイン層のチェックが**ほぼ重複する**

## 正しい理解：各層の責務

### 役割の明確な違い

```
┌─────────────────────────────────────────┐
│ Presentation層（Zod）                    │
│ ─────────────────────────────────       │
│ 役割: 入力の「形式」チェック              │
│ 観点: 「データとして成立しているか」       │
│ 例: 文字数、フォーマット、型              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Domain層（Value Object）                 │
│ ─────────────────────────────────       │
│ 役割: ビジネスの「意味」チェック          │
│ 観点: 「ビジネス的に許可されるか」        │
│ 例: 社内ドメインか、許可リストにあるか    │
└─────────────────────────────────────────┘
```

### バリデーションの多層構造（修正版）

```
1. クライアント側（HTML5）
   ↓ required, pattern, minLength など
   役割: UX向上（即座のフィードバック）
   信頼性: ❌ 低い（簡単にバイパス可能）

2. サーバー側（Zod）
   ↓ 型チェック、基本フォーマット検証
   役割: 不正な入力の早期検出、フィールドごとのエラー返却
   信頼性: ✅ 高い（サーバーで実行）

3. ドメイン層（Value Objects）
   ↓ ビジネスルール・不変条件の保証
   役割: ドメインの整合性を保つ
   信頼性: ✅✅ 最高（ドメインの中心）

4. アプリケーション層（Commands）
   ↓ 複数集約を跨ぐビジネスルール
   役割: 重複チェック、権限チェックなど
   信頼性: ✅ 高い
```

## 具体例：正しい責務分担

### 例 1: メールアドレス

#### ✅ 正しい実装

```typescript
// ========================================
// Zod: 形式チェックのみ
// ========================================
export const createEmployeeSchema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("有効なメールアドレス形式ではありません"),
  // ↑ 「@が含まれているか」「RFC準拠か」だけをチェック
});

// ========================================
// Domain: ビジネスルールのみ
// ========================================
export class Email {
  private readonly _value: string;

  constructor(value: string) {
    // 前提: Zodで基本フォーマットは検証済み

    // ビジネスルール: 社内メールアドレスのみ許可
    if (!this.isAllowedDomain(value)) {
      throw new BusinessRuleViolationError(
        "社内メールアドレス(@company.com, @partner.com)のみ使用できます"
      );
    }

    this._value = value.toLowerCase().trim();
  }

  private isAllowedDomain(email: string): boolean {
    const allowedDomains = ["company.com", "partner.com"];
    const domain = email.split("@")[1];
    return allowedDomains.includes(domain);
  }
}
```

#### ❌ 誤った実装（重複）

```typescript
// Zodで全部チェックしようとする
email: z.string()
  .email("形式エラー")
  .refine((val) => val.endsWith("@company.com"), "社内メール限定"); // ビジネスルールまでZodに書く

// ドメイン層でも同じチェック → 重複！
class Email {
  constructor(value: string) {
    if (!value.includes("@")) {
      /* 形式チェック - Zodと重複 */
    }
    if (!value.endsWith("@company.com")) {
      /* ビジネスルール */
    }
  }
}
```

### 例 2: 従業員コード

```typescript
// ========================================
// Zod: フォーマットチェック
// ========================================
employeeCd: z.string().regex(
  /^EMP\d{6}$/,
  "従業員コードはEMP + 6桁の数字で入力してください"
);
// ↑ 「EMP000001」という形式かどうかだけ

// ========================================
// Domain: ビジネスルール
// ========================================
export class EmployeeCd {
  private readonly _value: string;

  constructor(value: string) {
    // 前提: Zodで「EMP + 6桁」形式は検証済み

    // ビジネスルール:
    // - 特定の部署コード（EMP001xxx）は管理者のみ作成可能
    // - 退職者のコード（EMP999xxx）は再利用不可
    if (value.startsWith("EMP001")) {
      throw new BusinessRuleViolationError(
        "管理者用従業員コードは特権が必要です"
      );
    }
    if (value.startsWith("EMP999")) {
      throw new BusinessRuleViolationError("退職者コードは再利用できません");
    }

    this._value = value.toUpperCase();
  }
}
```

### 例 3: パスワード

```typescript
// ========================================
// Zod: 長さと文字種のチェック
// ========================================
password: z.string()
  .min(8, "パスワードは8文字以上で入力してください")
  .max(100, "パスワードは100文字以内で入力してください");
// ↑ 物理的な制約のみ

// ========================================
// Domain: ビジネスルール
// ========================================
export class Password {
  private readonly _hashedValue: string;

  constructor(plainPassword: string) {
    // 前提: Zodで長さは検証済み

    // ビジネスルール:
    // - 過去に使用したパスワードは使用不可（別の場所でチェック）
    // - 辞書攻撃対策（よくあるパスワードは禁止）
    if (this.isCommonPassword(plainPassword)) {
      throw new BusinessRuleViolationError(
        "よく使われるパスワードは使用できません"
      );
    }

    // ハッシュ化（Value Objectの責務ではないかもしれない）
    this._hashedValue = this.hash(plainPassword);
  }

  private isCommonPassword(password: string): boolean {
    const commonPasswords = ["password", "12345678", "qwerty"];
    return commonPasswords.includes(password.toLowerCase());
  }
}
```

## エラーハンドリングの実装

```typescript
// actions.ts
export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    email: formData.get("email"),
    // ...
  };

  // ========================================
  // 1. Zodバリデーション（フォーマット検証）
  // ========================================
  const result = createEmployeeSchema.safeParse(rawData);
  if (!result.success) {
    const { fieldErrors } = z.flattenError(result.error);
    return {
      success: false,
      errors: fieldErrors, // UIにフィールドごとのエラー表示
    };
  }

  try {
    // ========================================
    // 2. ドメイン層（ビジネスルール検証）
    // ========================================
    const email = new Email(result.data.email);
    const employeeCd = new EmployeeCd(result.data.employeeCd);
    // ...
  } catch (error) {
    // ビジネスルールエラーもフィールドエラーとして返す
    if (error instanceof BusinessRuleViolationError) {
      return {
        success: false,
        errors: {
          email: [error.message], // どのフィールドかを特定
        },
      };
    }
    return handleCommandError(error);
  }
}
```

## 各層のチェック内容まとめ

| 層              | 検証内容                     | 例                                                 | エラー種類                       |
| --------------- | ---------------------------- | -------------------------------------------------- | -------------------------------- |
| **Zod**         | データ型、基本フォーマット   | 「メールアドレス形式か」「8 文字以上か」「数値か」 | `ValidationError` (フィールド別) |
| **Domain**      | ビジネスルール、ドメイン制約 | 「社内メールか」「管理者コードか」「在庫があるか」 | `BusinessRuleViolationError`     |
| **Application** | 複数集約を跨ぐルール         | 「メールアドレス重複」「権限チェック」             | `BusinessRuleViolationError`     |

## Zod が必要な理由

### ✅ Zod がある理由

1. **フィールドごとのエラーメッセージ** ← 最大の理由

   - UI で「どのフィールドがエラーか」を明確に表示できる
   - ドメイン層のエラーだと「どのフィールドか」を特定しにくい

2. **型安全性**

   - FormData（すべて `string | File`）から安全に型変換

3. **早期検出**

   - ドメイン層に渡す前に不正な入力を弾く（パフォーマンス向上）

4. **UX 向上**
   - エラーメッセージがフィールドに紐付く
   - ユーザーがどこを修正すべきか一目でわかる

### ❌ 「ドメイン層だけで十分」ではない理由

ドメイン層だけの場合：

```typescript
try {
  const email = new Email(formData.get("email"));
} catch (error) {
  // どのフィールドのエラーかわからない
  return { success: false, error: error.message };
}
```

→ UI で「メールアドレスフィールドの下」にエラーを表示できない

Zod がある場合：

```typescript
if (!result.success) {
  return {
    success: false,
    errors: {
      email: ["有効なメールアドレス形式ではありません"],
    },
  };
}
```

→ UI で正確にフィールド別エラー表示可能

## 設計原則

### 重複を恐れない

- Zod とドメイン層で**似たようなチェック**があっても問題ない
- **役割が違う**ため、重複ではなく**責務分担**

### 各層は独立させる

- Zod はドメイン層を知らない
- ドメイン層は Zod を知らない
- それぞれが独立して機能する

### エラーメッセージも役割が違う

```
Zod: 「形式が違います」
  → ユーザー向け、具体的な修正方法を提示

Domain: 「このビジネスルールに違反しています」
  → ビジネス的な制約を説明
```

## まとめ

### Key Takeaways

1. **Zod は形式チェック、ドメインはビジネスルールチェック**

   - 重複ではなく、明確な責務分担

2. **Zod は必須**

   - フィールドごとのエラー表示のため
   - 型安全性のため

3. **Presentation 層（Zod）は軽いチェックで OK**

   - 文字数、フォーマット、型に限定
   - ビジネスルールはドメイン層に任せる

4. **ドメイン層はビジネスに集中**
   - 形式チェックはしない（Zod で済んでいる前提）
   - ビジネス的に許可されるかだけを判断

### 実装時の指針

- Zod スキーマを書くときは「形式として成立しているか」だけを考える
- Value Object を書くときは「ビジネス的に許可されるか」だけを考える
- 各層のエラーメッセージは目的に応じて使い分ける

## 関連リソース

- CLAUDE.md: バリデーション層の基本方針
- `web/src/app/employees/new/schema.ts`: Zod スキーマの実装例
- `web/src/shared/domain/valueObjects/Email.ts`: Value Object の実装例（今後実装予定）
