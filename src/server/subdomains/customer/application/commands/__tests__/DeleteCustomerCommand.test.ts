import prisma from "@server/prisma";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteCustomerCommand } from "../DeleteCustomerCommand";

describe("DeleteCustomerCommand", () => {
  let command: DeleteCustomerCommand;
  let repository: PrismaCustomerRepository;
  let testCustomerId: string;

  const TEST_CODES = ["CUST999914"];

  beforeEach(async () => {
    await prisma.customer.deleteMany({
      where: { code: { in: TEST_CODES } },
    });

    repository = new PrismaCustomerRepository();
    command = new DeleteCustomerCommand(repository);

    // テスト用得意先を事前作成
    const customer = Customer.create(
      new CompanyCode(TEST_CODES[0]),
      new CompanyName("削除テスト得意先")
    );
    const saved = await repository.insert(customer);
    testCustomerId = saved.id.value;
  });

  afterEach(async () => {
    await prisma.customer.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  });

  it("得意先を削除できる", async () => {
    await command.execute({ id: testCustomerId, expectedVersion: 1 });

    const deleted = await repository.findById(new CustomerId(testCustomerId));
    expect(deleted).toBeNull();
  });

  it("存在しないIDの場合は NotFoundEntityError", async () => {
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow(NotFoundEntityError);
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow("得意先が見つかりません");
  });

  it("stale な expectedVersion での削除は ConflictError（expectedVersion 素通しの検証）", async () => {
    // 別ユーザーが更新して version を 1 → 2 へ進める
    const loaded = await repository.findById(new CustomerId(testCustomerId));
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    loaded.changeName(new CompanyName("更新後"));
    await repository.update(loaded, 1);

    // stale な version 1 のまま削除 → 競合として弾かれる（素通しが効いている証左）
    await expect(command.execute({ id: testCustomerId, expectedVersion: 1 })).rejects.toThrow(
      ConflictError
    );

    // 行は残存している（誤削除が防止された）
    const stillThere = await repository.findById(new CustomerId(testCustomerId));
    expect(stillThere).not.toBeNull();
  });
});
