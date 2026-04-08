import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteDeliveryLocationCommand } from "../DeleteDeliveryLocationCommand";

describe("DeleteDeliveryLocationCommand", () => {
  let command: DeleteDeliveryLocationCommand;
  let dlRepository: PrismaDeliveryLocationRepository;
  let customerRepository: PrismaCustomerRepository;
  let testCustomerId: string;
  let testDeliveryLocationId: string;

  const DL_TEST_CODES = ["DL999914"];
  const CUSTOMER_TEST_CODE = "CUST999933";

  beforeEach(async () => {
    await prisma.company.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.company.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });

    customerRepository = new PrismaCustomerRepository();
    dlRepository = new PrismaDeliveryLocationRepository();
    command = new DeleteDeliveryLocationCommand(dlRepository);

    // テスト用得意先を事前作成
    const customer = Customer.create(
      new CompanyCode(CUSTOMER_TEST_CODE),
      new CompanyName("削除テスト用得意先")
    );
    const savedCustomer = await customerRepository.save(customer);
    testCustomerId = savedCustomer.id;

    // テスト用納品先を事前作成
    const dl = DeliveryLocation.create(
      new CompanyCode(DL_TEST_CODES[0]),
      new CompanyName("削除テスト納品先"),
      testCustomerId
    );
    const savedDl = await dlRepository.save(dl);
    testDeliveryLocationId = savedDl.id;
  });

  afterEach(async () => {
    await prisma.company.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.company.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });
  });

  it("納品先を削除できる", async () => {
    await command.execute({ id: testDeliveryLocationId });

    const deleted = await dlRepository.findById(testDeliveryLocationId);
    expect(deleted).toBeNull();
  });

  it("存在しないIDの場合は NotFoundEntityError", async () => {
    await expect(command.execute({ id: "00000000-0000-7000-8000-000000000000" })).rejects.toThrow(
      NotFoundEntityError
    );
    await expect(command.execute({ id: "00000000-0000-7000-8000-000000000000" })).rejects.toThrow(
      "納品先が見つかりません"
    );
  });
});
