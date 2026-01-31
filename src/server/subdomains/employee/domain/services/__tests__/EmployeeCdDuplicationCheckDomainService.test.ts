import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { InMemoryEmployeeRepository } from "@subdomains/employee/infrastructure/in-memory/InMemoryEmployeeRepository";
import { beforeEach, describe, expect, test } from "vitest";
import { EmployeeCdDuplicationCheckDomainService } from "../EmployeeCdDuplicationCheckDomainService";

describe("EmployeeCdDuplicationCheckDomainService", () => {
  let employeeCdDuplicationCheckDomainService: EmployeeCdDuplicationCheckDomainService;
  let inMemoryEmployeeRepository: InMemoryEmployeeRepository;

  beforeEach(() => {
    // テスト前に初期化する
    inMemoryEmployeeRepository = new InMemoryEmployeeRepository();
    employeeCdDuplicationCheckDomainService = new EmployeeCdDuplicationCheckDomainService(
      inMemoryEmployeeRepository
    );
  });

  test("重複がない場合、falseを返す", async () => {
    const employeeCd = new EmployeeCd("EMP000001");
    const result = await employeeCdDuplicationCheckDomainService.execute(employeeCd);
    expect(result).toBeFalsy();
  });

  test("重複がある場合、trueを返す", async () => {
    const employeeCd = new EmployeeCd("EMP000001");
    const email = new MailAddress("test@example.com");
    const name = new EmployeeName("山田太郎");
    const employee = Employee.create(employeeCd, email, name, "dept-001");

    await inMemoryEmployeeRepository.save(employee);

    const result = await employeeCdDuplicationCheckDomainService.execute(employeeCd);
    expect(result).toBeTruthy();
  });

  test("異なるEmployeeで重複がない場合、falseを返す", async () => {
    const existingEmployeeCd = new EmployeeCd("EMP000001");
    const newEmployeeCd = new EmployeeCd("EMP000002");
    const email = new MailAddress("test@example.com");
    const name = new EmployeeName("山田太郎");
    const employee = Employee.create(existingEmployeeCd, email, name, "dept-001");

    await inMemoryEmployeeRepository.save(employee);

    const result = await employeeCdDuplicationCheckDomainService.execute(newEmployeeCd);
    expect(result).toBeFalsy();
  });
});
