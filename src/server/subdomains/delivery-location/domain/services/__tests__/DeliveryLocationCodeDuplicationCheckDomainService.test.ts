import prisma from "@server/prisma";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeliveryLocationCodeDuplicationCheckDomainService } from "../DeliveryLocationCodeDuplicationCheckDomainService";

describe("DeliveryLocationCodeDuplicationCheckDomainService", () => {
  let service: DeliveryLocationCodeDuplicationCheckDomainService;
  let dlRepository: PrismaDeliveryLocationRepository;
  let customerRepository: PrismaCustomerRepository;
  let customerId: CustomerId;

  const DL_TEST_CODES = ["DL999801", "DL999802"];
  const CUSTOMER_TEST_CODE = "CUST999811";

  // クリーンアップ（FK制約考慮: DL の Company → Customer の Company の順）
  async function cleanup() {
    await prisma.company.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.company.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });
  }

  beforeEach(async () => {
    await cleanup();

    // FK依存: Customer フィクスチャを作成
    customerRepository = new PrismaCustomerRepository();
    const customer = Customer.create(
      new CompanyCode(CUSTOMER_TEST_CODE),
      new CompanyName("テスト得意先")
    );
    const savedCustomer = await customerRepository.save(customer);
    customerId = savedCustomer.id;

    dlRepository = new PrismaDeliveryLocationRepository();
    service = new DeliveryLocationCodeDuplicationCheckDomainService(dlRepository);
  });

  afterEach(cleanup);

  it("重複がない場合、falseを返す", async () => {
    const code = new CompanyCode(DL_TEST_CODES[0]);
    const isDuplicated = await service.execute(code);
    expect(isDuplicated).toBe(false);
  });

  it("重複がある場合、trueを返す", async () => {
    const code = new CompanyCode(DL_TEST_CODES[0]);
    const dl = DeliveryLocation.create(code, new CompanyName("テスト倉庫"), customerId);
    await dlRepository.save(dl);

    const isDuplicated = await service.execute(code);
    expect(isDuplicated).toBe(true);
  });

  it("異なるコードで重複がない場合、falseを返す", async () => {
    const existingCode = new CompanyCode(DL_TEST_CODES[0]);
    const dl = DeliveryLocation.create(existingCode, new CompanyName("テスト倉庫"), customerId);
    await dlRepository.save(dl);

    const newCode = new CompanyCode(DL_TEST_CODES[1]);
    const isDuplicated = await service.execute(newCode);
    expect(isDuplicated).toBe(false);
  });
});
