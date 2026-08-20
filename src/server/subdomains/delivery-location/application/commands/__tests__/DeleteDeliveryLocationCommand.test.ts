import prisma from "@server/prisma";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteDeliveryLocationCommand } from "../DeleteDeliveryLocationCommand";

describe("DeleteDeliveryLocationCommand", () => {
  let command: DeleteDeliveryLocationCommand;
  let dlRepository: PrismaDeliveryLocationRepository;
  let customerRepository: PrismaCustomerRepository;
  let testDeliveryLocationId: string;

  const DL_TEST_CODES = ["DL999914"];
  const CUSTOMER_TEST_CODE = "CUST999933";

  beforeEach(async () => {
    await prisma.deliveryLocation.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.customer.deleteMany({
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
    const savedCustomer = await customerRepository.insert(customer);
    // テスト用納品先を事前作成
    const dl = DeliveryLocation.create(
      new CompanyCode(DL_TEST_CODES[0]),
      new CompanyName("削除テスト納品先"),
      savedCustomer.id
    );
    const savedDl = await dlRepository.insert(dl);
    testDeliveryLocationId = savedDl.id.value;
  });

  afterEach(async () => {
    await prisma.deliveryLocation.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.customer.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });
  });

  it("納品先を削除できる", async () => {
    await command.execute({ id: testDeliveryLocationId, expectedVersion: 1 });

    const deleted = await dlRepository.findById(new DeliveryLocationId(testDeliveryLocationId));
    expect(deleted).toBeNull();
  });

  it("存在しないIDの場合は NotFoundEntityError", async () => {
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow(NotFoundEntityError);
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow("納品先が見つかりません");
  });

  it("stale な expectedVersion での削除は ConflictError（expectedVersion 素通しの検証）", async () => {
    // 別ユーザーが更新して version を 1 → 2 へ進める
    const loaded = await dlRepository.findById(new DeliveryLocationId(testDeliveryLocationId));
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    loaded.changeName(new CompanyName("更新後"));
    await dlRepository.update(loaded, 1);

    // stale な version 1 のまま削除 → 競合として弾かれる（素通しが効いている証左）
    await expect(
      command.execute({ id: testDeliveryLocationId, expectedVersion: 1 })
    ).rejects.toThrow(ConflictError);

    // 行は残存している（誤削除が防止された）
    const stillThere = await dlRepository.findById(new DeliveryLocationId(testDeliveryLocationId));
    expect(stillThere).not.toBeNull();
  });
});
