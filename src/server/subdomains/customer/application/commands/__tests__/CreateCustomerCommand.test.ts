import prisma from "@server/prisma";
import { ValidationError } from "@server/shared/errors/DomainError";
import { CustomerCodeDuplicationCheckDomainService } from "@subdomains/customer/domain/services/CustomerCodeDuplicationCheckDomainService";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateCustomerCommand } from "../CreateCustomerCommand";

describe("CreateCustomerCommand", () => {
  let command: CreateCustomerCommand;
  let repository: PrismaCustomerRepository;
  let codeDuplicationCheckService: CustomerCodeDuplicationCheckDomainService;

  const TEST_CODES = ["CUST999911", "CUST999912"];

  beforeEach(async () => {
    await prisma.company.deleteMany({
      where: { code: { in: TEST_CODES } },
    });

    repository = new PrismaCustomerRepository();
    codeDuplicationCheckService = new CustomerCodeDuplicationCheckDomainService(repository);

    command = new CreateCustomerCommand(repository, codeDuplicationCheckService);
  });

  afterEach(async () => {
    await prisma.company.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  });

  it("得意先を新規登録できる（必須項目のみ）", async () => {
    await command.execute({
      code: TEST_CODES[0],
      name: "テスト得意先A",
    });

    const saved = await repository.findByCode(new CompanyCode(TEST_CODES[0]));
    expect(saved).not.toBeNull();
    expect(saved?.name.value).toBe("テスト得意先A");
    expect(saved?.code.value).toBe(TEST_CODES[0]);
    expect(saved?.isActive).toBe(true);
    expect(saved?.marginRate).toBeNull();
  });

  it("全オプション項目付きで新規登録できる", async () => {
    await command.execute({
      code: TEST_CODES[0],
      name: "テスト得意先B",
      postalCode: "100-0001",
      prefecture: "東京都",
      address: "千代田区1-1-1",
      phoneNumber: "03-1234-5678",
      faxNumber: "03-1234-5679",
      contactPerson: "担当太郎",
      marginRate: 15.5,
    });

    const saved = await repository.findByCode(new CompanyCode(TEST_CODES[0]));
    expect(saved).not.toBeNull();
    expect(saved?.name.value).toBe("テスト得意先B");
    expect(saved?.postalCode?.value).toBe("1000001");
    expect(saved?.prefecture?.value).toBe("東京都");
    expect(saved?.address?.value).toBe("千代田区1-1-1");
    expect(saved?.phoneNumber?.value).toBe("0312345678");
    expect(saved?.faxNumber?.value).toBe("0312345679");
    expect(saved?.contactPerson).toBe("担当太郎");
    expect(saved?.marginRate?.value).toBe(15.5);
  });

  it("コードが重複している場合は ValidationError", async () => {
    await command.execute({
      code: TEST_CODES[0],
      name: "重複元",
    });

    await expect(
      command.execute({
        code: TEST_CODES[0],
        name: "重複先",
      })
    ).rejects.toThrow(ValidationError);
  });
});
