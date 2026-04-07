import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateCustomerCommand } from "../UpdateCustomerCommand";

describe("UpdateCustomerCommand", () => {
  let command: UpdateCustomerCommand;
  let repository: PrismaCustomerRepository;
  let testCustomerId: string;

  const TEST_CODES = ["CUST999913"];

  beforeEach(async () => {
    await prisma.company.deleteMany({
      where: { code: { in: TEST_CODES } },
    });

    repository = new PrismaCustomerRepository();
    command = new UpdateCustomerCommand(repository);

    // テスト用得意先を事前作成
    const customer = Customer.create(
      new CompanyCode(TEST_CODES[0]),
      new CompanyName("更新前得意先")
    );
    const saved = await repository.save(customer);
    testCustomerId = saved.id.value;
  });

  afterEach(async () => {
    await prisma.company.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  });

  it("得意先情報を更新できる（名前変更）", async () => {
    await command.execute({
      id: testCustomerId,
      name: "更新後得意先",
    });

    const updated = await repository.findById(new CustomerId(testCustomerId));
    expect(updated).not.toBeNull();
    expect(updated?.name.value).toBe("更新後得意先");
  });

  it("住所・連絡先・マージン率を更新できる", async () => {
    await command.execute({
      id: testCustomerId,
      name: "更新前得意先",
      postalCode: "200-0002",
      prefecture: "大阪府",
      address: "大阪市2-2-2",
      phoneNumber: "06-1234-5678",
      faxNumber: "06-1234-5679",
      contactPerson: "更新担当",
      marginRate: 20,
    });

    const updated = await repository.findById(new CustomerId(testCustomerId));
    expect(updated).not.toBeNull();
    expect(updated?.postalCode?.value).toBe("2000002");
    expect(updated?.prefecture?.value).toBe("大阪府");
    expect(updated?.address?.value).toBe("大阪市2-2-2");
    expect(updated?.phoneNumber?.value).toBe("0612345678");
    expect(updated?.faxNumber?.value).toBe("0612345679");
    expect(updated?.contactPerson).toBe("更新担当");
    expect(updated?.marginRate?.value).toBe(20);
  });

  it("isActive を変更できる", async () => {
    // deactivate
    await command.execute({
      id: testCustomerId,
      name: "更新前得意先",
      isActive: false,
    });

    let updated = await repository.findById(new CustomerId(testCustomerId));
    expect(updated?.isActive).toBe(false);

    // activate
    await command.execute({
      id: testCustomerId,
      name: "更新前得意先",
      isActive: true,
    });

    updated = await repository.findById(new CustomerId(testCustomerId));
    expect(updated?.isActive).toBe(true);
  });

  it("nullを渡すとオプション項目をクリアできる", async () => {
    // まず値を設定
    await command.execute({
      id: testCustomerId,
      name: "更新前得意先",
      postalCode: "200-0002",
      prefecture: "大阪府",
      address: "大阪市2-2-2",
      phoneNumber: "06-1234-5678",
      faxNumber: "06-1234-5679",
      contactPerson: "更新担当",
      marginRate: 20,
    });

    // nullで全クリア
    await command.execute({
      id: testCustomerId,
      name: "更新前得意先",
      postalCode: null,
      prefecture: null,
      address: null,
      phoneNumber: null,
      faxNumber: null,
      contactPerson: null,
      marginRate: null,
    });

    const updated = await repository.findById(new CustomerId(testCustomerId));
    expect(updated).not.toBeNull();
    expect(updated?.postalCode).toBeNull();
    expect(updated?.prefecture).toBeNull();
    expect(updated?.address).toBeNull();
    expect(updated?.phoneNumber).toBeNull();
    expect(updated?.faxNumber).toBeNull();
    expect(updated?.contactPerson).toBeNull();
    expect(updated?.marginRate).toBeNull();
  });

  it("存在しないIDの場合は NotFoundEntityError", async () => {
    await expect(
      command.execute({
        id: "00000000-0000-7000-8000-000000000000",
        name: "存在しない",
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
