import { Employee } from "@/domain/entities/Employee";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { InMemoryEmployeeRepository } from "@/Infrastructure/InMemory/Employee/InMemoryEmployeeRepository";
import { beforeEach, describe, expect, test } from "vitest";
import { EmployeeDuplicationCheckDomainService } from "./EmployeeDuplicationCheckDomainService";

describe("EmployeeDuplicationCheckDomainService", () => {
  let employeeDuplicationCheckDomainService: EmployeeDuplicationCheckDomainService;
  let inMemoryEmployeeRepository: InMemoryEmployeeRepository;

  beforeEach(() => {
    // テスト前に初期化する
    inMemoryEmployeeRepository = new InMemoryEmployeeRepository();
    employeeDuplicationCheckDomainService =
      new EmployeeDuplicationCheckDomainService(inMemoryEmployeeRepository);
  });

  test("重複がない場合、falseを返す", async () => {
    const employeeCd = new EmployeeCd("EMP000001");
    const result = await employeeDuplicationCheckDomainService.execute(
      employeeCd
    );
    expect(result).toBeFalsy();
  });

  test("重複がある場合、trueを返す", async () => {
    const employeeCd = new EmployeeCd("EMP000001");
    const email = new MailAddress("test@example.com");
    const name = "山田太郎";
    const passwordHash = "hashed_password_123";
    const employee = Employee.create(employeeCd, email, name, passwordHash);

    await inMemoryEmployeeRepository.save(employee);

    const result = await employeeDuplicationCheckDomainService.execute(
      employeeCd
    );
    expect(result).toBeTruthy();
  });

  test("異なるEmployeeで重複がない場合、falseを返す", async () => {
    const existingEmployeeCd = new EmployeeCd("EMP000001");
    const newEmployeeCd = new EmployeeCd("EMP000002");
    const email = new MailAddress("test@example.com");
    const name = "山田太郎";
    const passwordHash = "hashed_password_123";
    const employee = Employee.create(
      existingEmployeeCd,
      email,
      name,
      passwordHash
    );

    await inMemoryEmployeeRepository.save(employee);

    const result = await employeeDuplicationCheckDomainService.execute(
      newEmployeeCd
    );
    expect(result).toBeFalsy();
  });
});
