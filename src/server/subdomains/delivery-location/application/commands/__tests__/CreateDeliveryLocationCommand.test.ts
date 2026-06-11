import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocationCodeDuplicationCheckDomainService } from "@subdomains/delivery-location/domain/services/DeliveryLocationCodeDuplicationCheckDomainService";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateDeliveryLocationCommand } from "../CreateDeliveryLocationCommand";

describe("CreateDeliveryLocationCommand", () => {
  let command: CreateDeliveryLocationCommand;
  let dlRepository: PrismaDeliveryLocationRepository;
  let customerRepository: PrismaCustomerRepository;
  let codeDuplicationCheckService: DeliveryLocationCodeDuplicationCheckDomainService;
  let testCustomerId: string;

  const DL_TEST_CODES = ["DL999911", "DL999912"];
  const CUSTOMER_TEST_CODE = "CUST999931";

  beforeEach(async () => {
    // 納品先 → 得意先の順で削除（FK 制約）
    await prisma.deliveryLocation.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.customer.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });

    customerRepository = new PrismaCustomerRepository();
    dlRepository = new PrismaDeliveryLocationRepository();
    codeDuplicationCheckService = new DeliveryLocationCodeDuplicationCheckDomainService(
      dlRepository
    );

    command = new CreateDeliveryLocationCommand(
      dlRepository,
      customerRepository,
      codeDuplicationCheckService
    );

    // テスト用得意先を事前作成
    const customer = Customer.create(
      new CompanyCode(CUSTOMER_TEST_CODE),
      new CompanyName("納品先テスト用得意先")
    );
    const saved = await customerRepository.save(customer);
    testCustomerId = saved.id.value;
  });

  afterEach(async () => {
    await prisma.deliveryLocation.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.customer.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });
  });

  it("納品先を新規登録できる（必須項目のみ）", async () => {
    await command.execute({
      code: DL_TEST_CODES[0],
      name: "テスト納品先A",
      customerId: testCustomerId,
    });

    const saved = await dlRepository.findByCode(new CompanyCode(DL_TEST_CODES[0]));
    expect(saved).not.toBeNull();
    expect(saved?.name.value).toBe("テスト納品先A");
    expect(saved?.code.value).toBe(DL_TEST_CODES[0]);
    expect(saved?.customerId.value).toBe(testCustomerId);
    expect(saved?.isActive).toBe(true);
    expect(saved?.deliveryNotes).toBeNull();
  });

  it("全オプション項目付きで新規登録できる", async () => {
    await command.execute({
      code: DL_TEST_CODES[0],
      name: "テスト納品先B",
      customerId: testCustomerId,
      postalCode: "100-0001",
      prefecture: "東京都",
      address: "千代田区1-1-1",
      phoneNumber: "03-1234-5678",
      faxNumber: "03-1234-5679",
      contactPerson: "配送担当",
      deliveryNotes: "裏口から搬入してください",
    });

    const saved = await dlRepository.findByCode(new CompanyCode(DL_TEST_CODES[0]));
    expect(saved).not.toBeNull();
    expect(saved?.name.value).toBe("テスト納品先B");
    expect(saved?.postalCode?.value).toBe("1000001");
    expect(saved?.prefecture?.value).toBe("東京都");
    expect(saved?.address?.value).toBe("千代田区1-1-1");
    expect(saved?.phoneNumber?.value).toBe("0312345678");
    expect(saved?.faxNumber?.value).toBe("0312345679");
    expect(saved?.contactPerson).toBe("配送担当");
    expect(saved?.deliveryNotes?.value).toBe("裏口から搬入してください");
  });

  it("コードが重複している場合は ValidationError", async () => {
    await command.execute({
      code: DL_TEST_CODES[0],
      name: "重複元納品先",
      customerId: testCustomerId,
    });

    await expect(
      command.execute({
        code: DL_TEST_CODES[0],
        name: "重複先納品先",
        customerId: testCustomerId,
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        code: DL_TEST_CODES[0],
        name: "重複先納品先",
        customerId: testCustomerId,
      })
    ).rejects.toThrow("既に存在する取引先コードです");
  });

  it("親得意先が存在しない場合は NotFoundEntityError", async () => {
    await expect(
      command.execute({
        code: DL_TEST_CODES[0],
        name: "親なし納品先",
        customerId: "00000000-0000-7000-8000-000000000002",
      })
    ).rejects.toThrow(NotFoundEntityError);
    await expect(
      command.execute({
        code: DL_TEST_CODES[0],
        name: "親なし納品先",
        customerId: "00000000-0000-7000-8000-000000000002",
      })
    ).rejects.toThrow("得意先が見つかりません");
  });

  it("親得意先が無効化されている場合は ValidationError", async () => {
    // 得意先を無効化
    const customer = await customerRepository.findById(new CustomerId(testCustomerId));
    customer!.deactivate();
    await customerRepository.save(customer!);

    await expect(
      command.execute({
        code: DL_TEST_CODES[0],
        name: "無効得意先の納品先",
        customerId: testCustomerId,
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        code: DL_TEST_CODES[0],
        name: "無効得意先の納品先",
        customerId: testCustomerId,
      })
    ).rejects.toThrow("無効化された得意先には納品先を追加できません");
  });
});
