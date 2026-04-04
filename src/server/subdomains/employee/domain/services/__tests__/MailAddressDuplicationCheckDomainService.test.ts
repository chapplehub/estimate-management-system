import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MailAddressDuplicationCheckDomainService } from "../MailAddressDuplicationCheckDomainService";

describe("MailAddressDuplicationCheckDomainService", () => {
  let service: MailAddressDuplicationCheckDomainService;
  let repository: PrismaEmployeeRepository;

  const TEST_CODES = ["EMP999831"];
  let TEST_DEPT_ID: string;

  async function cleanup() {
    await prisma.employee.deleteMany({
      where: { employeeCd: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();

    // 外部キー依存のフィクスチャ（upsert で冪等に作成）
    const dept = await prisma.department.upsert({
      where: { departmentCd: "TEST_DEPT" },
      update: {},
      create: {
        id: generateId(),
        departmentCd: "TEST_DEPT",
        name: "テスト部署",
        abbreviation: "テスト",
        isActive: true,
      },
    });
    TEST_DEPT_ID = dept.id;

    repository = new PrismaEmployeeRepository();
    service = new MailAddressDuplicationCheckDomainService(repository);
  });

  afterEach(cleanup);

  it("重複がない場合、falseを返す", async () => {
    const isDuplicated = await service.execute(new MailAddress("ds-mail-dup-new@example.com"));
    expect(isDuplicated).toBe(false);
  });

  it("重複がある場合、trueを返す", async () => {
    const employee = Employee.create(
      new EmployeeCd(TEST_CODES[0]),
      new MailAddress("ds-mail-dup-existing@example.com"),
      new EmployeeName("テスト太郎"),
      TEST_DEPT_ID
    );
    await repository.save(employee);

    const isDuplicated = await service.execute(new MailAddress("ds-mail-dup-existing@example.com"));
    expect(isDuplicated).toBe(true);
  });

  it("異なるメールアドレスで重複がない場合、falseを返す", async () => {
    const employee = Employee.create(
      new EmployeeCd(TEST_CODES[0]),
      new MailAddress("ds-mail-dup-existing@example.com"),
      new EmployeeName("テスト太郎"),
      TEST_DEPT_ID
    );
    await repository.save(employee);

    const isDuplicated = await service.execute(new MailAddress("ds-mail-dup-new@example.com"));
    expect(isDuplicated).toBe(false);
  });
});
