# エンティティメタ情報を使ったエラーメッセージの自動生成

## 概要

エンティティが見つからない場合のエラーメッセージで、「従業員が見つかりません」「部署が見つかりません」など、エンティティごとに固定メッセージを書くのは面倒。エンティティクラスにメタ情報を持たせることで、エラーメッセージを自動生成できるようにした。

エラークラスを以下のように分離：
- **`NotFoundError`**: 汎用的なリソースが見つからないエラー（メッセージ指定）
- **`NotFoundEntityError`**: エンティティ専用エラー（メタ情報を使った自動メッセージ生成）

## エラー階層の整理（DDD観点）

このプロジェクトでは、DDDの層に応じてエラークラスを以下のように分離しています：

### ドメイン層のエラー (`DomainError`)

**発生場所:** エンティティ、値オブジェクト、ドメインサービスの**内部ロジック**

```
DomainError (base)
├── ValidationError          - 値の形式が不正
├── InvalidArgumentError     - 引数が不正
└── BusinessRuleViolationError - ビジネスルール違反
```

**例:**
- メールアドレスの形式が不正
- アカウントがロックされている状態でログイン試行
- 在庫数がマイナスになる

### アプリケーション層のエラー (`ApplicationError`)

**発生場所:** ユースケース実行時の**前提条件チェック**

```
ApplicationError (base)
├── NotFoundError           - リソースが見つからない（汎用）
└── NotFoundEntityError     - エンティティが見つからない（専用）
```

**例:**
- 更新対象のエンティティが存在しない
- 参照しようとしたリソースが見つからない
- ユーザーに権限がない（将来実装）

### 設計判断の理由

1. **「エンティティが見つからない」はビジネスルール違反ではない**
   - ビジネスルール違反: エンティティの不変条件が破られる（例: 在庫がマイナス）
   - 前提条件不成立: エンティティ自体が存在しない

2. **責務の分離**
   - ドメイン層: ビジネスロジックの整合性を保証
   - アプリケーション層: ユースケース実行の前提条件を保証

## 問題

従来の実装では、エンティティが見つからない場合に以下のように手動でメッセージを組み立てる必要があった：

```typescript
if (!targetEmployee) {
  throw new NotFoundError("従業員が見つかりません: ID=xxx");
}

if (!targetDepartment) {
  throw new NotFoundError("部署が見つかりません: ID=yyy");
}
```

この方法の問題点：
- エンティティごとに「従業員が」「部署が」と書く必要がある
- タイポのリスク
- 多言語対応が困難
- エンティティ名の変更時に全箇所を修正する必要がある

## 解決策（案1）：静的プロパティ + オーバーロード

### 1. エンティティに静的メタ情報を追加

```typescript
// Employee.ts
export class Employee {
  static readonly ENTITY_NAME = "従業員";
  // ... 既存のコード
}
```

### 2. ApplicationError と NotFoundEntityError を作成

```typescript
// ApplicationError.ts

/**
 * アプリケーション層のベースエラークラス
 */
export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * リソースが見つからないエラー（汎用）
 */
export class NotFoundError extends ApplicationError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * エンティティが見つからないエラー（エンティティ専用）
 */
export class NotFoundEntityError extends ApplicationError {
  constructor(
    entityClass: { ENTITY_NAME: string },
    identifier: Record<string, unknown>
  ) {
    const entityName = entityClass.ENTITY_NAME;
    const identifierStr = Object.entries(identifier)
      .map(([key, value]) => `${key.toUpperCase()}=${value}`)
      .join(", ");
    super(`${entityName}が見つかりません: ${identifierStr}`);
  }
}
```

**設計判断：**
1. **層を跨いだエラー階層の分離**
   - `DomainError`: ドメイン層のビジネスロジック内で発生
   - `ApplicationError`: アプリケーション層のユースケース実行時に発生

2. **エラークラスの責務**
   - `NotFoundError`: 汎用的なリソースが見つからない
   - `NotFoundEntityError`: エンティティ専用でメタ情報を使った自動メッセージ生成

### 3. 使用例

```typescript
// Application層でエンティティが見つからない場合
if (!targetEmployee) {
  throw new NotFoundEntityError(Employee, { employeeCd: "EMP000001" });
  // → "従業員が見つかりません: EMPLOYEECD=EMP000001"
}

// 複数の識別子も可能
throw new NotFoundEntityError(Department, { id: "123", code: "DEPT001" });
// → "部署が見つかりません: ID=123, CODE=DEPT001"

// エンティティ以外のリソース（汎用）
throw new NotFoundError("指定された設定ファイルが見つかりません");
throw new NotFoundError("要求されたレポートが存在しません");
```

**識別子の選び方：**
- ❌ 内部ID（cuid）: `{ id: "clfxxxxx" }` - 人間に分かりにくい
- ✅ ビジネスID: `{ employeeCd: "EMP000001" }` - ユーザーに分かりやすい
- ✅ 複数指定: `{ employeeCd: "EMP000001", email: "test@example.com" }` - より詳細な情報

## メリット

1. **DRY原則の徹底** - エンティティ名を一箇所で管理
2. **タイプセーフ** - TypeScriptの型チェックが効く
3. **責務の明確化** - エンティティ専用エラーと汎用エラーを分離
4. **柔軟性** - 識別子を複数渡せる（id, code, emailなど）
5. **シンプル** - BaseEntityのような抽象クラスを強制しない
6. **ユーザーフレンドリー** - ビジネスIDを使えば分かりやすいエラーメッセージになる

## デメリット・制約

1. **各エンティティで手動設定が必要** - ENTITY_NAMEの定義を忘れる可能性
2. **型の強制力が弱い** - ENTITY_NAMEがない場合も型エラーにならない（structural typing）
3. **多言語対応は別途必要** - 現状は日本語固定

## 将来の改善案（BaseEntity案）

より厳格な型安全性と統一性を求める場合は、BaseEntityを導入する案も検討できる（[issue #5](https://github.com/chapplehub/estimate-management-system/issues/5) で追跡）：

```typescript
export abstract class BaseEntity {
  static readonly entityName: string;
}

export class Employee extends BaseEntity {
  static readonly entityName = "従業員";
}
```

この場合、すべてのエンティティがBaseEntityを継承する必要があるため、DDDの純粋性（エンティティが特定の基底クラスに依存しない）とのトレードオフがある。

## 関連ファイル

- `web/src/shared/errors/ApplicationError.ts` - ApplicationError, NotFoundEntityError の実装
- `web/src/shared/errors/DomainError.ts` - DomainError, ValidationError などの実装
- `web/src/domain/entities/Employee.ts` - ENTITY_NAME の定義
- `web/src/application/EmployeeApplicationService.ts` - 使用例

## 参考

- [エラーハンドリングのベストプラクティス](../docs/dev-guidelines.md)
