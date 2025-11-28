# テストコードにおける型アサーション（as unknown as）とインターフェース設計のトレードオフ

## 概要

テストコードでモックオブジェクトを作成する際に `as unknown as SomeClass` という型アサーションが必要になる理由と、それを解消するためにインターフェースを導入すべきかどうかのトレードオフについて。

## 詳細

### なぜ `as unknown as` が必要になるのか

クラスとオブジェクトリテラルでは、TypeScript が認識する「型の構造」が異なる。

```typescript
// クラス定義
class MailAddressDuplicationCheckDomainService {
  constructor(private employeeRepository: IEmployeeRepository) {}

  async execute(mailAddress: MailAddress): Promise<boolean> {
    // ...
  }
}
```

このクラスのインスタンスは TypeScript の視点から見ると以下を持つ：

1. `execute` メソッド
2. `employeeRepository` プロパティ（private）
3. クラスの「ブランド」（このクラスから生成されたという情報）

一方、モックオブジェクトを作成すると：

```typescript
const mockService = {
  execute: vi.fn(),
};
```

これは単なるオブジェクトリテラルで：

1. `execute` プロパティを持つ ✅
2. `employeeRepository` プロパティがない ❌
3. クラスの「ブランド」がない ❌

そのため型エラーが発生し、`as unknown as` で強制的に型を合わせる必要がある。

### インターフェースを導入すれば解決する

```typescript
interface IMailAddressDuplicationCheckDomainService {
  execute(mailAddress: MailAddress): Promise<boolean>;
}

let mockService: IMailAddressDuplicationCheckDomainService;

// ✅ 型エラーなし！
mockService = {
  execute: vi.fn(),
};
```

インターフェースは「`execute` メソッドがあればOK」という契約だけを定義するため、オブジェクトリテラルでも要件を満たせる。

### トレードオフの整理

| アプローチ | メリット | デメリット |
|-----------|---------|-----------|
| **インターフェース追加** | 型安全、IDE補完、依存性逆転 | ファイル数増加、冗長に感じる |
| **`as unknown as` 維持** | シンプル、ファイル少ない | 型安全性を犠牲、リファクタ時に気づきにくい |

### Repository と Domain Service の性質の違い

| | Repository | Domain Service |
|---|---|---|
| 実装が複数存在 | DB用、テスト用、キャッシュ用など | 通常1つだけ |
| インフラ層に依存 | する（DB, 外部API） | しない（純粋なドメインロジック） |
| インターフェース必須度 | 高い | 低い |

Repository はインフラ層の詳細を隠蔽するためにインターフェースが**必須**だが、ドメインサービスは純粋なドメインロジックなので差し替える必要性が低い。

### 結論

**テストコードにおける `as unknown as` は許容範囲の妥協点**

- インターフェースは「テストのため」ではなく「設計上の必要性」で導入すべき
- Repository にインターフェースがあるのは依存性逆転のためであり、すべてのクラスに同じパターンを適用する必要はない
- 「テストでモックしやすくするため」だけにインターフェースを作るのは過剰な抽象化（YAGNI原則違反）

### 代替案

`as unknown as` を使いたくない場合は Vitest の `vi.mock` パターンも検討できる：

```typescript
import { MailAddressDuplicationCheckDomainService } from "...";

vi.mock("@/shared/domain/services/MailAddressDuplicationCheckDomainService");

beforeEach(() => {
  mockService = new MailAddressDuplicationCheckDomainService(mockRepository);
  vi.mocked(mockService.execute).mockResolvedValue(false);
});
```

## 参考

- 関連ファイル: `src/subdomains/employee/commands/__tests__/UpdateEmployeeCommand.test.ts`
- 関連ファイル: `src/shared/domain/services/MailAddressDuplicationCheckDomainService.ts`
