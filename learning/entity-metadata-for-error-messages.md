# エンティティメタ情報を使ったエラーメッセージの自動生成

## 概要

エンティティが見つからない場合のエラーメッセージで、「従業員が見つかりません」「部署が見つかりません」など、エンティティごとに固定メッセージを書くのは面倒。エンティティクラスにメタ情報を持たせることで、エラーメッセージを自動生成できるようにした。

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

### 2. NotFoundError をオーバーロードで拡張

```typescript
// DomainError.ts
export class NotFoundError extends DomainError {
  // 従来の使い方（後方互換性）
  constructor(message: string);

  // 新しい使い方
  constructor(
    entityClass: { ENTITY_NAME: string },
    identifier: Record<string, unknown>
  );

  constructor(
    messageOrEntityClass: string | { ENTITY_NAME: string },
    identifier?: Record<string, unknown>
  ) {
    if (typeof messageOrEntityClass === "string") {
      super(messageOrEntityClass);
    } else {
      const entityName = messageOrEntityClass.ENTITY_NAME;
      const identifierStr = Object.entries(identifier!)
        .map(([key, value]) => `${key.toUpperCase()}=${value}`)
        .join(", ");
      super(`${entityName}が見つかりません: ${identifierStr}`);
    }
  }
}
```

### 3. 使用例

```typescript
// Application層での使用
if (!targetEmployee) {
  throw new NotFoundError(Employee, { id: command.id });
  // → "従業員が見つかりません: ID=xxx"
}

if (!targetEmployee) {
  throw new NotFoundError(Employee, { employeeCd: "EMP000001" });
  // → "従業員が見つかりません: EMPLOYEECD=EMP000001"
}

// 複数の識別子も可能
throw new NotFoundError(Department, { id: "123", code: "DEPT001" });
// → "部署が見つかりません: ID=123, CODE=DEPT001"
```

## メリット

1. **DRY原則の徹底** - エンティティ名を一箇所で管理
2. **タイプセーフ** - TypeScriptの型チェックが効く
3. **後方互換性** - 既存のコードは動き続ける
4. **柔軟性** - 識別子を複数渡せる（id, code, emailなど）
5. **シンプル** - BaseEntityのような抽象クラスを強制しない

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

- `web/src/shared/errors/DomainError.ts` - NotFoundError の実装
- `web/src/domain/entities/Employee.ts` - ENTITY_NAME の定義
- `web/src/application/EmployeeApplicationService.ts` - 使用例

## 参考

- [エラーハンドリングのベストプラクティス](../docs/dev-guidelines.md)
