# Vitest: インターフェース vs 具体クラスのモックの違い

## 概要

`vi.fn()` でモックを作成する際、インターフェースと具体クラスでは必要な型アサーションが異なる。

## 詳細

### インターフェースのモック（型アサーション不要）

```typescript
// インターフェース定義
interface IEmployeeRepository {
  save(employee: Employee): Promise<Employee>;
  findById(id: string): Promise<Employee | null>;
  // ...
}

// モック作成 - プロパティを揃えるだけでOK
let mockRepository: IEmployeeRepository;

mockRepository = {
  save: vi.fn(),
  findById: vi.fn(),
  findByEmployeeCd: vi.fn(),
  findByEmail: vi.fn(),
  delete: vi.fn(),
};
```

TypeScript の構造的型付け（Structural Typing）により、同じプロパティ名を持つオブジェクトは互換性があるとみなされる。

### 具体クラスのモック（型アサーション必要）

```typescript
// 具体クラス
class MailAddressDuplicationCheckDomainService {
  constructor(private repository: IEmployeeRepository) {}

  async execute(email: MailAddress, excludeId?: string): Promise<boolean> {
    // 実装...
  }
}

// モック作成 - as unknown as で強制的に型を変換
let mockService: MailAddressDuplicationCheckDomainService;

mockService = {
  execute: vi.fn(),
} as unknown as MailAddressDuplicationCheckDomainService;
```

具体クラスは private フィールド、コンストラクタ、prototype などを持つため、単純なオブジェクトリテラルでは型が合わない。`as unknown as` で TypeScript の型チェックをバイパスする。

### なぜ違いが生まれるか

| 種類 | TypeScript が見るもの | モックに必要なこと |
|------|---------------------|-------------------|
| **インターフェース** | プロパティのシグネチャのみ | 同じプロパティ名があればOK |
| **具体クラス** | プロパティ + private フィールド + コンストラクタ + prototype など | 完全一致が必要 → 無理なので強制変換 |

### `as unknown as` の意味

```typescript
{ execute: vi.fn() }          // 型: { execute: Mock<[], undefined> }
  as unknown                  // 一旦「何でもあり」にリセット
  as MailAddressDuplicationCheckDomainService  // 目的の型に強制変換
```

### vi.fn() の実行時動作について

`vi.fn()` 自体は何も実装されていないため、呼び出すと `undefined` を返す。
テストで正しい値を返すには `mockResolvedValue` 等で設定が必要：

```typescript
vi.mocked(mockRepository.findById).mockResolvedValue(existingEmployee);
```

## 教訓：DDD でインターフェースを使う理由

テスト容易性の観点からも、依存関係はインターフェースで定義するのが良い。

```typescript
// ドメインサービスもインターフェースにすれば...
interface IMailDuplicationCheckService {
  execute(email: MailAddress, excludeId?: string): Promise<boolean>;
}

// モックが簡単になる
mockService: IMailDuplicationCheckService = {
  execute: vi.fn(),
};
```

## 参考

- 関連ファイル: `src/subdomains/employee/commands/__tests__/UpdateEmployeeCommand.test.ts`
- Vitest ドキュメント: https://vitest.dev/api/mock.html
