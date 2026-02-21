import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteCustomerCommand } from "../DeleteCustomerCommand";

describe("DeleteCustomerCommand", () => {
  let command: DeleteCustomerCommand;
  let repository: PrismaCustomerRepository;
  let testCustomerId: string;

  const TEST_CODES = ["CUST999914"];

  beforeEach(async () => {
    await prisma.company.deleteMany({
      where: { code: { in: TEST_CODES } },
    });

    repository = new PrismaCustomerRepository();
    command = new DeleteCustomerCommand(repository);

    // テスト用得意先を事前作成
    const customer = Customer.create(
      new CompanyCode(TEST_CODES[0]),
      new CompanyName("削除テスト得意先")
    );
    const saved = await repository.save(customer);
    testCustomerId = saved.id;
  });

  afterEach(async () => {
    await prisma.company.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  });

  it("得意先を削除できる", async () => {
    await command.execute({ id: testCustomerId });

    const deleted = await repository.findById(testCustomerId);
    expect(deleted).toBeNull();
  });

  it("存在しないIDの場合は NotFoundEntityError", async () => {
    await expect(command.execute({ id: "non-existent-id" })).rejects.toThrow(NotFoundEntityError);
  });
});
