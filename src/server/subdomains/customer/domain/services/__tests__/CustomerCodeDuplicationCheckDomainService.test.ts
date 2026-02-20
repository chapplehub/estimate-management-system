import prisma from "@server/prisma";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CustomerCodeDuplicationCheckDomainService } from "../CustomerCodeDuplicationCheckDomainService";

describe("CustomerCodeDuplicationCheckDomainService", () => {
  let service: CustomerCodeDuplicationCheckDomainService;
  let repository: PrismaCustomerRepository;

  const TEST_CODES = ["CUST999801", "CUST999802"];

  async function cleanup() {
    // Company 削除で Customer にカスケード
    await prisma.company.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();

    repository = new PrismaCustomerRepository();
    service = new CustomerCodeDuplicationCheckDomainService(repository);
  });

  afterEach(cleanup);

  it("重複がない場合、falseを返す", async () => {
    const isDuplicated = await service.execute(new CompanyCode(TEST_CODES[0]));
    expect(isDuplicated).toBe(false);
  });

  it("重複がある場合、trueを返す", async () => {
    const customer = Customer.create(
      new CompanyCode(TEST_CODES[0]),
      new CompanyName("テスト株式会社")
    );
    await repository.save(customer);

    const isDuplicated = await service.execute(new CompanyCode(TEST_CODES[0]));
    expect(isDuplicated).toBe(true);
  });

  it("異なるコードで重複がない場合、falseを返す", async () => {
    const customer = Customer.create(
      new CompanyCode(TEST_CODES[0]),
      new CompanyName("テスト株式会社")
    );
    await repository.save(customer);

    const isDuplicated = await service.execute(new CompanyCode(TEST_CODES[1]));
    expect(isDuplicated).toBe(false);
  });
});
