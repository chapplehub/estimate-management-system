import prisma from "@server/prisma";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmployeeCdDuplicationCheckDomainService } from "../EmployeeCdDuplicationCheckDomainService";

describe("EmployeeCdDuplicationCheckDomainService", () => {
  let service: EmployeeCdDuplicationCheckDomainService;
  let repository: PrismaEmployeeRepository;

  const TEST_CODES = ["EMP999821", "EMP999822"];
  const TEST_DEPT_ID = "dept-001";

  async function cleanup() {
    await prisma.employee.deleteMany({
      where: { employeeCd: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();

    // 外部キー依存のフィクスチャ（upsert で冪等に作成）
    await prisma.department.upsert({
      where: { id: TEST_DEPT_ID },
      update: {},
      create: {
        id: TEST_DEPT_ID,
        departmentCd: "DEPT001",
        name: "テスト部署",
        abbreviation: "テスト",
        displayOrder: 1,
        isActive: true,
      },
    });

    repository = new PrismaEmployeeRepository();
    service = new EmployeeCdDuplicationCheckDomainService(repository);
  });

  afterEach(cleanup);

  it("重複がない場合、falseを返す", async () => {
    const isDuplicated = await service.execute(new EmployeeCd(TEST_CODES[0]));
    expect(isDuplicated).toBe(false);
  });

  it("重複がある場合、trueを返す", async () => {
    const employee = Employee.create(
      new EmployeeCd(TEST_CODES[0]),
      new MailAddress("ds-empcd-dup@example.com"),
      new EmployeeName("テスト太郎"),
      TEST_DEPT_ID
    );
    await repository.save(employee);

    const isDuplicated = await service.execute(new EmployeeCd(TEST_CODES[0]));
    expect(isDuplicated).toBe(true);
  });

  it("異なるEmployeeで重複がない場合、falseを返す", async () => {
    const employee = Employee.create(
      new EmployeeCd(TEST_CODES[0]),
      new MailAddress("ds-empcd-dup@example.com"),
      new EmployeeName("テスト太郎"),
      TEST_DEPT_ID
    );
    await repository.save(employee);

    const isDuplicated = await service.execute(new EmployeeCd(TEST_CODES[1]));
    expect(isDuplicated).toBe(false);
  });
});
