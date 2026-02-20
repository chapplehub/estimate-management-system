---
name: testing-backend
description: バックエンドテスト作成パターン。Domain層・Application層のテスト作成時に使用。Value Object, Entity, Domain Service, Command, Query のテスト規約とパターンを提供
user-invokable: true
---

# Backend Testing Patterns

## 1. テスト戦略

| レイヤー | テスト種別 | アプローチ |
|---|---|---|
| **Domain層** (VO, Entity) | 単体テスト | 純粋なインメモリ。外部依存なし |
| **Domain層** (Domain Service) | 統合テスト | 実DB (Prisma) を使用 |
| **Application層** (Command, Query) | **統合テスト** | **実DB (Prisma) を使用。モック不使用** |
| **Infrastructure層** | **テスト不要** | Application層テストが間接的にカバー |

- Application 層では `vi.fn()` モックを使わない
- 外部サービス依存には Fake 実装を使う（例: `FakeUserManagementService`）
- Infrastructure 層の個別テストは書かない（Application 層テストで十分）

## 2. 共通規約

### ファイル配置

テストファイルはテスト対象と同階層の `__tests__/` ディレクトリに配置する。

```
domain/values/__tests__/EmployeeCd.test.ts
domain/entities/__tests__/Employee.test.ts
domain/services/__tests__/EmployeeCdDuplicationCheckDomainService.test.ts
application/commands/__tests__/CreateEmployeeCommand.test.ts
infrastructure/queries/__tests__/PrismaEmployeeQueryService.test.ts
```

### 記述ルール

- `it()` を使用する（`test()` は使わない）
- `describe()` の第一引数はクラス名のみ（例: `describe("EmployeeCd", ...)`）
- テスト記述はすべて日本語
- エラーテストはエラー**型のみ**検証する（メッセージは検証しない）
- AAA パターン（Arrange-Act-Assert）を基本とする

```typescript
// ✅ Good
it("社員コードが重複している場合エラー", async () => {
  await expect(command.execute(input)).rejects.toThrow(DuplicationError);
});

// ❌ Bad - メッセージを検証
it("社員コードが重複している場合エラー", async () => {
  await expect(command.execute(input)).rejects.toThrow("社員コードが重複しています");
});
```

### パスエイリアス

```typescript
import { ... } from "@server/...";
import { ... } from "@subdomains/...";
import { ... } from "@shared/...";
import { ... } from "@generated/...";
```

## 3. Pattern: Value Object テスト

純粋な単体テスト。外部依存なし。`正常系` / `異常系` で describe を分ける。

```typescript
import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EmployeeCd } from "../EmployeeCd";

describe("EmployeeCd", () => {
  describe("正常系", () => {
    it("有効な社員コードでインスタンスを作成できる", () => {
      const empCd = new EmployeeCd("EMP000001");
      expect(empCd.value).toBe("EMP000001");
    });

    it("同じ社員コードは等価である", () => {
      const empCd1 = new EmployeeCd("EMP000001");
      const empCd2 = new EmployeeCd("EMP000001");
      expect(empCd1.equals(empCd2)).toBe(true);
    });

    // 境界値テスト（最小値・最大値）
    // 正規化テスト（trim, toUpperCase 等）
  });

  describe("異常系", () => {
    it("空文字列の場合はエラー", () => {
      expect(() => new EmployeeCd("")).toThrow(ValidationError);
    });

    it("形式が不正な場合はエラー", () => {
      expect(() => new EmployeeCd("INVALID")).toThrow(ValidationError);
    });
  });
});
```

> **参考実装:** `src/server/subdomains/employee/domain/values/__tests__/EmployeeCd.test.ts`

## 4. Pattern: Entity テスト

`beforeEach` で VO フィクスチャを準備。create / reconstruct / 振る舞いメソッドをテスト。

```typescript
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { describe, expect, it, beforeEach } from "vitest";
import { Employee } from "../Employee";

describe("Employee", () => {
  let employeeCd: EmployeeCd;
  let email: MailAddress;
  let name: EmployeeName;
  let departmentId: string;

  beforeEach(() => {
    employeeCd = new EmployeeCd("EMP000001");
    email = new MailAddress("test@example.com");
    name = new EmployeeName("山田太郎");
    departmentId = "dept-001";
  });

  describe("ファクトリメソッド", () => {
    describe("create", () => {
      it("新規従業員を作成できる", () => {
        const employee = Employee.create(employeeCd, email, name, departmentId);

        expect(employee.id).toBeTruthy();
        expect(employee.employeeCd.value).toBe("EMP000001");
        expect(employee.email.value).toBe("test@example.com");
      });

      it("作成するたびに一意のIDが生成される", () => {
        const e1 = Employee.create(employeeCd, email, name, departmentId);
        const e2 = Employee.create(employeeCd, email, name, departmentId);
        expect(e1.id).not.toBe(e2.id);
      });
    });

    describe("reconstruct", () => {
      it("DBから従業員を再構築できる", () => {
        const employee = Employee.reconstruct(
          "id-123", employeeCd, email, name, departmentId,
          new Date("2025-01-01"), new Date("2025-01-02"),
        );
        expect(employee.id).toBe("id-123");
      });
    });
  });

  describe("名前変更", () => {
    it("名前を変更できる", () => {
      const employee = Employee.create(employeeCd, email, name, departmentId);
      employee.changeName(new EmployeeName("鈴木花子"));
      expect(employee.name.value).toBe("鈴木花子");
    });
  });
});
```

> **参考実装:** `src/server/subdomains/employee/domain/entities/__tests__/Employee.test.ts`

## 5. Pattern: Domain Service テスト

**実 PrismaRepository** を使用する統合テスト。Command テストと同じ DB クリーンアップパターンに従う。

```typescript
import prisma from "@server/prisma";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmployeeCdDuplicationCheckDomainService } from "../EmployeeCdDuplicationCheckDomainService";

describe("EmployeeCdDuplicationCheckDomainService", () => {
  let service: EmployeeCdDuplicationCheckDomainService;
  let repository: PrismaEmployeeRepository;

  // テストデータ定数（cleanup・テスト本体の両方でこの定数を使う）
  const TEST_CODES = ["EMP999821", "EMP999822"];
  const TEST_EMAIL = "ds-empcd-dup@example.com";
  const TEST_DEPT_ID = "dept-001";

  beforeEach(async () => {
    await prisma.employee.deleteMany({
      where: { employeeCd: { in: TEST_CODES } },
    });

    await prisma.department.upsert({
      where: { id: TEST_DEPT_ID },
      update: {},
      create: {
        id: TEST_DEPT_ID,
        departmentCd: "DEPT001",
        name: "テスト部署",
        abbreviation: "テスト",
        displayOrder: 1,
        isActive: true,
      },
    });

    repository = new PrismaEmployeeRepository();
    service = new EmployeeCdDuplicationCheckDomainService(repository);
  });

  afterEach(async () => {
    await prisma.employee.deleteMany({
      where: { employeeCd: { in: TEST_CODES } },
    });
  });

  it("重複がない場合、falseを返す", async () => {
    const result = await service.execute(new EmployeeCd(TEST_CODES[0]));
    expect(result).toBe(false);
  });

  it("重複がある場合、trueを返す", async () => {
    const employee = Employee.create(
      new EmployeeCd(TEST_CODES[0]),
      new MailAddress(TEST_EMAIL),
      new EmployeeName("テスト太郎"),
      TEST_DEPT_ID,
    );
    await repository.save(employee);

    const result = await service.execute(new EmployeeCd(TEST_CODES[0]));
    expect(result).toBe(true);
  });
});
```

> **参考実装:** `src/server/subdomains/employee/domain/services/__tests__/EmployeeCdDuplicationCheckDomainService.test.ts`

## 6. Pattern: Command 統合テスト

**実 PrismaRepository** を使用。`vi.fn()` モックは使わない。

### DB クリーンアップ

- `beforeEach` / `afterEach` の両方でクリーンアップ（テスト中断時の残留対策）
- 外部キー依存は `upsert` で冪等に作成

### 外部サービス依存

- 認証サービス等の外部依存には Fake 実装を注入する
- Fake は `src/server/shared/auth/fake/` に配置

```typescript
import { FakeUserManagementService } from "@server/shared/auth/fake/FakeUserManagementService";
import { USER_ROLES } from "@server/shared/auth/types";
import { ValidationError } from "@server/shared/errors/DomainError";
import prisma from "@server/prisma";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateEmployeeCommand } from "../CreateEmployeeCommand";

describe("CreateEmployeeCommand", () => {
  let command: CreateEmployeeCommand;
  let repository: PrismaEmployeeRepository;
  let fakeUserManagementService: FakeUserManagementService;

  // テストデータ定数（cleanup・テスト本体の両方でこの定数を使う）
  const TEST_CODES = ["EMP999911"];
  const TEST_EMAIL = "test-create-cmd@example.com";
  const TEST_DEPT_ID = "dept-001";

  beforeEach(async () => {
    await prisma.employee.deleteMany({
      where: { employeeCd: { in: TEST_CODES } },
    });

    await prisma.department.upsert({
      where: { id: TEST_DEPT_ID },
      update: {},
      create: {
        id: TEST_DEPT_ID,
        departmentCd: "DEPT001",
        name: "テスト部署",
        abbreviation: "テスト",
        displayOrder: 1,
        isActive: true,
      },
    });

    repository = new PrismaEmployeeRepository();
    fakeUserManagementService = new FakeUserManagementService();

    command = new CreateEmployeeCommand(
      repository,
      new EmployeeCdDuplicationCheckDomainService(repository),
      new MailAddressDuplicationCheckDomainService(repository),
      fakeUserManagementService,
    );
  });

  afterEach(async () => {
    await prisma.employee.deleteMany({
      where: { employeeCd: { in: TEST_CODES } },
    });
  });

  it("従業員を新規登録できる", async () => {
    await command.execute({
      employeeCd: TEST_CODES[0],
      email: TEST_EMAIL,
      name: "テスト太郎",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      password: "Password1!",
    });

    const saved = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(saved).not.toBeNull();
    expect(saved?.email.value).toBe(TEST_EMAIL);
  });

  it("認証ユーザー作成失敗時、保存したEmployeeが削除される", async () => {
    fakeUserManagementService.setCreateUserToFail(true);

    await expect(
      command.execute({ ... })
    ).rejects.toThrow(ValidationError);

    const employee = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(employee).toBeNull();
  });
});
```

> **参考実装:** `src/server/subdomains/employee/application/commands/__tests__/CreateEmployeeCommand.test.ts`

## 7. Pattern: Query 統合テスト

**実 PrismaQueryService** を使用。テストデータはヘルパー関数で作成。

```typescript
import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import type { UserRole } from "@server/shared/auth/types";
import { USER_ROLES } from "@server/shared/auth/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaEmployeeQueryService } from "../PrismaEmployeeQueryService";

describe("PrismaEmployeeQueryService", () => {
  let queryService: PrismaEmployeeQueryService;
  const testEmployeeIds: string[] = [];
  const testUserIds: string[] = [];

  /** テスト用の Employee + User を作成するヘルパー */
  async function createTestEmployeeWithUser(data: {
    employeeCd: string;
    email: string;
    name: string;
    role: UserRole;
    departmentId?: string;
  }) {
    const employeeId = createId();
    const userId = createId();

    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: data.employeeCd,
        email: data.email,
        name: data.name,
        departmentId: data.departmentId ?? "dept-001",
      },
    });

    await prisma.user.create({
      data: {
        id: userId,
        email: data.email,
        name: data.name,
        employeeId: employeeId,
        role: data.role,
      },
    });

    testEmployeeIds.push(employeeId);
    testUserIds.push(userId);
    return { employeeId, userId };
  }

  beforeEach(async () => {
    queryService = new PrismaEmployeeQueryService();
    testEmployeeIds.length = 0;
    testUserIds.length = 0;

    // クリーンアップ + フィクスチャ
    await prisma.user.deleteMany({ ... });
    await prisma.employee.deleteMany({ ... });
    await prisma.department.upsert({ ... });
  });

  afterEach(async () => {
    // テストデータ削除（User → Employee の順で FK 制約を守る）
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: testEmployeeIds } } });
  });

  describe("findById", () => {
    it("IDで従業員を取得できる", async () => {
      const { employeeId } = await createTestEmployeeWithUser({
        employeeCd: "EMP999901",
        email: "query-test@example.com",
        name: "QueryTest",
        role: USER_ROLES.USER,
      });

      const found = await queryService.findById(employeeId);
      expect(found).not.toBeNull();
      expect(found?.employeeCd).toBe("EMP999901");
    });

    it("存在しないIDの場合nullを返す", async () => {
      const found = await queryService.findById("non-existent-id");
      expect(found).toBeNull();
    });
  });
});
```

> **参考実装:** `src/server/subdomains/employee/infrastructure/queries/__tests__/PrismaEmployeeQueryService.test.ts`
