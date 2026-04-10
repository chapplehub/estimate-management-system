---
name: testing-backend
description: バックエンドテスト作成パターン。Use when Domain層・Application層のテスト作成時に使用。Value Object, Entity, Domain Service, Command, Query のテスト規約とパターンを提供
user-invocable: true
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
application/queries/__tests__/CountEmployeesQuery.test.ts
```

### 記述ルール

- `it()` を使用する（`test()` は使わない）
- `describe()` の第一引数はクラス名のみ（例: `describe("EmployeeCd", ...)`）
- テスト記述はすべて日本語
- エラーの発生源では**型 + ハードコード文字列**でメッセージもテストする
- バブルアップするエラー（下位層で発生し上位層に伝播するだけのもの）はテスト不要
- AAA パターン（Arrange-Act-Assert）を基本とする

```typescript
// ✅ Good - 発生源で型 + メッセージの両方を検証
it("社員コードが重複している場合エラー", async () => {
  await expect(command.execute(input)).rejects.toThrow(ValidationError);
  await expect(command.execute(input)).rejects.toThrow("既に存在する従業員CDです");
});

// ✅ Good - VOの発生源でメッセージを検証
it("空文字列はエラー", () => {
  expect(() => new EmployeeCd("")).toThrow(ValidationError);
  expect(() => new EmployeeCd("")).toThrow("社員コードは必須です");
});

// ❌ Bad - 発生源なのにメッセージを検証していない
it("社員コードが重複している場合エラー", async () => {
  await expect(command.execute(input)).rejects.toThrow(ValidationError);
});

// ❌ Bad - 共有定数を使ってメッセージを検証（テストが実装に結合する）
it("空文字列はエラー", () => {
  expect(() => new EmployeeCd("")).toThrow(EmployeeCd.ERROR_MESSAGES.REQUIRED);
});
```

### テストデータ定数

- cleanup 条件とテスト本体の両方で使う値（`employeeCd`, `departmentId` 等）は必ず定数化する
- テスト本体でしか使わない値（`email`, `name` 等）はインラインで可

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
      expect(() => new EmployeeCd("")).toThrow("社員コードは必須です");
    });

    it("形式が不正な場合はエラー", () => {
      expect(() => new EmployeeCd("INVALID")).toThrow(ValidationError);
      expect(() => new EmployeeCd("INVALID")).toThrow(
        "社員コードは EMP + 6桁の数字である必要があります"
      );
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

- `cleanup()` 関数を定義し `beforeEach`/`afterEach` から呼び出す
- 外部キー依存（Department 等）は `upsert` で冪等に作成
- テスト対象の Domain Service に実 Repository を注入

> **参考実装:** `src/server/subdomains/employee/domain/services/__tests__/EmployeeCdDuplicationCheckDomainService.test.ts`

## 6. Pattern: Command 統合テスト

**実 PrismaRepository** を使用。`vi.fn()` モックは使わない。

- `beforeEach` / `afterEach` の両方でクリーンアップ（テスト中断時の残留対策）
- 外部キー依存は `upsert` で冪等に作成
- 認証サービス等の外部依存には Fake 実装を注入する（`src/server/shared/auth/fake/`）

> **参考実装:** `src/server/subdomains/employee/application/commands/__tests__/CreateEmployeeCommand.test.ts`

## 7. Pattern: Query 統合テスト

**実 PrismaQueryService** を Query クラスに注入する統合テスト。

- `createTestEmployeeWithUser()` ヘルパーで Employee + User をセットで作成
- `testEmployeeIds` / `testUserIds` 配列で作成済みIDを追跡
- `afterEach` で User → Employee の順（FK制約順）で削除
- `beforeEach` では `employeeCd` ベースで既存データを削除（テスト中断時の残留対策）

> **参考実装:** `src/server/subdomains/employee/application/queries/__tests__/CountEmployeesQuery.test.ts`
