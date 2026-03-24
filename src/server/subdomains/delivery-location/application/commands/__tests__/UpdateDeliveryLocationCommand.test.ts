import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateDeliveryLocationCommand } from "../UpdateDeliveryLocationCommand";

describe("UpdateDeliveryLocationCommand", () => {
  let command: UpdateDeliveryLocationCommand;
  let dlRepository: PrismaDeliveryLocationRepository;
  let customerRepository: PrismaCustomerRepository;
  let testCustomerId: string;
  let testDeliveryLocationId: string;

  const DL_TEST_CODES = ["DL999913"];
  const CUSTOMER_TEST_CODE = "CUST999932";

  beforeEach(async () => {
    await prisma.company.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.company.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });

    customerRepository = new PrismaCustomerRepository();
    dlRepository = new PrismaDeliveryLocationRepository();
    command = new UpdateDeliveryLocationCommand(dlRepository);

    // テスト用得意先を事前作成
    const customer = Customer.create(
      new CompanyCode(CUSTOMER_TEST_CODE),
      new CompanyName("更新テスト用得意先")
    );
    const savedCustomer = await customerRepository.save(customer);
    testCustomerId = savedCustomer.id;

    // テスト用納品先を事前作成
    const dl = DeliveryLocation.create(
      new CompanyCode(DL_TEST_CODES[0]),
      new CompanyName("更新前納品先"),
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

  it("納品先情報を更新できる（名前変更）", async () => {
    await command.execute({
      id: testDeliveryLocationId,
      name: "更新後納品先",
    });

    const updated = await dlRepository.findById(testDeliveryLocationId);
    expect(updated).not.toBeNull();
    expect(updated?.name.value).toBe("更新後納品先");
  });

  it("住所・連絡先・配送メモを更新できる", async () => {
    await command.execute({
      id: testDeliveryLocationId,
      name: "更新前納品先",
      postalCode: "300-0003",
      prefecture: "愛知県",
      address: "名古屋市3-3-3",
      phoneNumber: "052-1234-5678",
      faxNumber: "052-1234-5679",
      contactPerson: "配送更新担当",
      deliveryNotes: "午前中のみ受付可能",
    });

    const updated = await dlRepository.findById(testDeliveryLocationId);
    expect(updated).not.toBeNull();
    expect(updated?.postalCode?.value).toBe("3000003");
    expect(updated?.prefecture?.value).toBe("愛知県");
    expect(updated?.address?.value).toBe("名古屋市3-3-3");
    expect(updated?.phoneNumber?.value).toBe("05212345678");
    expect(updated?.faxNumber?.value).toBe("05212345679");
    expect(updated?.contactPerson).toBe("配送更新担当");
    expect(updated?.deliveryNotes?.value).toBe("午前中のみ受付可能");
  });

  it("isActive を変更できる", async () => {
    // deactivate
    await command.execute({
      id: testDeliveryLocationId,
      name: "更新前納品先",
      isActive: false,
    });

    let updated = await dlRepository.findById(testDeliveryLocationId);
    expect(updated?.isActive).toBe(false);

    // activate
    await command.execute({
      id: testDeliveryLocationId,
      name: "更新前納品先",
      isActive: true,
    });

    updated = await dlRepository.findById(testDeliveryLocationId);
    expect(updated?.isActive).toBe(true);
  });

  it("nullを渡すとオプション項目をクリアできる", async () => {
    // まず値を設定
    await command.execute({
      id: testDeliveryLocationId,
      name: "更新前納品先",
      postalCode: "300-0003",
      prefecture: "愛知県",
      address: "名古屋市3-3-3",
      phoneNumber: "052-1234-5678",
      faxNumber: "052-1234-5679",
      contactPerson: "配送更新担当",
      deliveryNotes: "午前中のみ受付可能",
    });

    // nullで全クリア
    await command.execute({
      id: testDeliveryLocationId,
      name: "更新前納品先",
      postalCode: null,
      prefecture: null,
      address: null,
      phoneNumber: null,
      faxNumber: null,
      contactPerson: null,
      deliveryNotes: null,
    });

    const updated = await dlRepository.findById(testDeliveryLocationId);
    expect(updated).not.toBeNull();
    expect(updated?.postalCode).toBeNull();
    expect(updated?.prefecture).toBeNull();
    expect(updated?.address).toBeNull();
    expect(updated?.phoneNumber).toBeNull();
    expect(updated?.faxNumber).toBeNull();
    expect(updated?.contactPerson).toBeNull();
    expect(updated?.deliveryNotes).toBeNull();
  });

  it("存在しないIDの場合は NotFoundEntityError", async () => {
    await expect(
      command.execute({
        id: "non-existent-id",
        name: "存在しない",
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
