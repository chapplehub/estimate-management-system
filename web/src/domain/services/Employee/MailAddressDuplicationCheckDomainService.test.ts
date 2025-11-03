import { Employee } from "@/domain/entities/Employee";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { InMemoryEmployeeRepository } from "@/Infrastructure/InMemory/Employee/InMemoryEmployeeRepository";
import { beforeEach, describe, expect, test } from "vitest";
import { MailAddressDuplicationCheckDomainService } from "./MailAddressDuplicationCheckDomainService";

describe("MailAddressDuplicationCheckDomainService", () => {
  let mailAddressDuplicationCheckDomainService: MailAddressDuplicationCheckDomainService;
  let inMemoryEmployeeRepository: InMemoryEmployeeRepository;

  beforeEach(() => {
    // テスト前に初期化する
    inMemoryEmployeeRepository = new InMemoryEmployeeRepository();
    mailAddressDuplicationCheckDomainService =
      new MailAddressDuplicationCheckDomainService(inMemoryEmployeeRepository);
  });

  test("重複がない場合、falseを返す", async () => {
    const mailAddress = new MailAddress("test@example.com");
    const result = await mailAddressDuplicationCheckDomainService.execute(
      mailAddress
    );
    expect(result).toBeFalsy();
  });

  test("重複がある場合、trueを返す", async () => {
    const employeeCd = new EmployeeCd("EMP000001");
    const mailAddress = new MailAddress("test@example.com");
    const name = "山田太郎";
    const passwordHash = "hashed_password_123";
    const employee = Employee.create(employeeCd, mailAddress, name, passwordHash);

    await inMemoryEmployeeRepository.save(employee);

    const result = await mailAddressDuplicationCheckDomainService.execute(
      mailAddress
    );
    expect(result).toBeTruthy();
  });

  test("異なるEmployeeで重複がない場合、falseを返す", async () => {
    const employeeCd = new EmployeeCd("EMP000001");
    const existingMailAddress = new MailAddress("existing@example.com");
    const newMailAddress = new MailAddress("new@example.com");
    const name = "山田太郎";
    const passwordHash = "hashed_password_123";
    const employee = Employee.create(
      employeeCd,
      existingMailAddress,
      name,
      passwordHash
    );

    await inMemoryEmployeeRepository.save(employee);

    const result = await mailAddressDuplicationCheckDomainService.execute(
      newMailAddress
    );
    expect(result).toBeFalsy();
  });
});
