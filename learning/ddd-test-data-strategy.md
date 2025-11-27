# DDDプロジェクトにおけるテストデータ戦略

## 概要

DDDアーキテクチャにおいて、テストデータをインメモリで管理するか実DBを使うかは、テスト対象の**責務**によって決まる。

## 詳細

### 原則

テストデータの管理方法は、テスト対象の責務に応じて選択する。

### レイヤー別の指針

| 対象 | データソース | 理由 |
|------|-------------|------|
| Value Object / Entity | インメモリ | 永続化は責務外。ビジネスルールのみをテスト |
| Application層（UseCase） | モック | Repositoryインターフェースをモックし、ビジネスロジックに集中 |
| Repository実装 | 実DB | SQL/Prismaクエリが正しく動くか検証が必要 |
| 統合テスト / E2E | 実DB | レイヤー間の連携、実際のデータフローを検証 |

### テストピラミッド

```
        /\
       /E2E\        ← 実DB（少数）
      /------\
     /Integration\  ← 実DB（中程度）
    /--------------\
   /   Unit Tests   \ ← インメモリ/モック（多数）
  /------------------\
```

### コード例

#### Domain層（インメモリ）

```typescript
// Value ObjectやEntityは純粋なロジックのみをテスト
describe("Email", () => {
  it("should create valid email", () => {
    const email = Email.create("test@example.com");
    expect(email.value).toBe("test@example.com");
  });
});
```

#### Application層（モック使用）

```typescript
// Repositoryインターフェースをモック
const mockEmployeeRepository: IEmployeeRepository = {
  findByEmployeeCd: vi.fn().mockResolvedValue(testEmployee),
  save: vi.fn().mockResolvedValue(undefined),
};

const useCase = new CreateEmployeeUseCase(mockEmployeeRepository);
```

#### Infrastructure層（実DB使用）

```typescript
// 実際のDBを使ってクエリを検証
beforeEach(async () => {
  await prisma.employee.deleteMany(); // クリーンアップ
});

it("should save employee to database", async () => {
  const repo = new PrismaEmployeeRepository(prisma);
  await repo.save(testEmployee);

  const found = await prisma.employee.findUnique({
    where: { employeeCd: "EMP000001" }
  });
  expect(found).not.toBeNull();
});
```

## ポイント

- **DDDの責務分離がテスト戦略にも反映される**
- Domain層は外部依存がないため、高速なユニットテストが可能
- Infrastructure層は実DBを使うことで、クエリや制約の検証ができる
- 「このコンポーネントの責務は何か？」を問うことで、適切なテスト方法が決まる

## 参考

- テストピラミッドの概念（Martin Fowler）
- DDD（ドメイン駆動設計）のレイヤードアーキテクチャ
