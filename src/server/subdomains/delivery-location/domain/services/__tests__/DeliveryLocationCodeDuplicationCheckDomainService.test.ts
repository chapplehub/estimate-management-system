import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { InMemoryDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/in-memory/InMemoryDeliveryLocationRepository";
import { beforeEach, describe, expect, test } from "vitest";
import { DeliveryLocationCodeDuplicationCheckDomainService } from "../DeliveryLocationCodeDuplicationCheckDomainService";

describe("DeliveryLocationCodeDuplicationCheckDomainService", () => {
  let service: DeliveryLocationCodeDuplicationCheckDomainService;
  let repository: InMemoryDeliveryLocationRepository;

  beforeEach(() => {
    repository = new InMemoryDeliveryLocationRepository();
    service = new DeliveryLocationCodeDuplicationCheckDomainService(repository);
  });

  test("重複がない場合、falseを返す", async () => {
    const code = new CompanyCode("DL001");
    const isDuplicated = await service.execute(code);
    expect(isDuplicated).toBe(false);
  });

  test("重複がある場合、trueを返す", async () => {
    const code = new CompanyCode("DL001");
    const dl = DeliveryLocation.create(code, new CompanyName("テスト倉庫"), "customer-id");
    await repository.save(dl);

    const isDuplicated = await service.execute(code);
    expect(isDuplicated).toBe(true);
  });

  test("異なるコードで重複がない場合、falseを返す", async () => {
    const existingCode = new CompanyCode("DL001");
    const dl = DeliveryLocation.create(existingCode, new CompanyName("テスト倉庫"), "customer-id");
    await repository.save(dl);

    const newCode = new CompanyCode("DL002");
    const isDuplicated = await service.execute(newCode);
    expect(isDuplicated).toBe(false);
  });
});
