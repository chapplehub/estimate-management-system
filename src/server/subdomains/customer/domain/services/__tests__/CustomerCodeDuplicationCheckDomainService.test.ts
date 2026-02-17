import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { InMemoryCustomerRepository } from "@subdomains/customer/infrastructure/in-memory/InMemoryCustomerRepository";
import { beforeEach, describe, expect, test } from "vitest";
import { CustomerCodeDuplicationCheckDomainService } from "../CustomerCodeDuplicationCheckDomainService";

describe("CustomerCodeDuplicationCheckDomainService", () => {
  let service: CustomerCodeDuplicationCheckDomainService;
  let repository: InMemoryCustomerRepository;

  beforeEach(() => {
    repository = new InMemoryCustomerRepository();
    service = new CustomerCodeDuplicationCheckDomainService(repository);
  });

  test("重複がない場合、falseを返す", async () => {
    const code = new CompanyCode("CUST001");
    const isDuplicated = await service.execute(code);
    expect(isDuplicated).toBe(false);
  });

  test("重複がある場合、trueを返す", async () => {
    const code = new CompanyCode("CUST001");
    const customer = Customer.create(code, new CompanyName("テスト株式会社"));
    await repository.save(customer);

    const isDuplicated = await service.execute(code);
    expect(isDuplicated).toBe(true);
  });

  test("異なるコードで重複がない場合、falseを返す", async () => {
    const existingCode = new CompanyCode("CUST001");
    const customer = Customer.create(existingCode, new CompanyName("テスト株式会社"));
    await repository.save(customer);

    const newCode = new CompanyCode("CUST002");
    const isDuplicated = await service.execute(newCode);
    expect(isDuplicated).toBe(false);
  });
});
