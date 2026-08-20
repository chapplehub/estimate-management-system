import type { Estimate } from "@subdomains/estimate/domain/entities";
import type { CreateEstimateCommand } from "@subdomains/estimate/application/commands/CreateEstimateCommand";
import type { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { describe, expect, it, vi } from "vitest";
import { checkTaxRateThenCreate } from "../checkTaxRateThenCreate";

/** taxRate を除いた作成入力の最小フィクスチャ（関数は中身を検証せず委譲するだけ）。 */
function inputFixture() {
  return {
    estimateType: "NEW",
    estimateDate: new Date("2019-09-30T00:00:00+09:00"),
    deadline: new Date("2019-10-31T00:00:00+09:00"),
    customerId: "00000000-0000-7000-8000-000000000001",
    deliveryLocationId: "00000000-0000-7000-8000-000000000002",
    taxRoundingType: "ROUND_DOWN",
    createdBy: "00000000-0000-7000-8000-000000000003",
    departmentId: "00000000-0000-7000-8000-000000000004",
    variations: [],
  };
}

describe("checkTaxRateThenCreate", () => {
  it("税率が一致するとき、解決税率をコマンドへ注入して作成し created を返す", async () => {
    const sentinel = { id: "estimate" } as unknown as Estimate;
    const execute = vi.fn().mockResolvedValue(sentinel);
    const check = vi.fn().mockResolvedValue({ kind: "consistent", rate: new TaxRate(0.1) });

    const result = await checkTaxRateThenCreate(inputFixture(), {
      taxRateConsistencyCheck: { check } as unknown as TaxRateConsistencyCheckDomainService,
      createCommand: { execute } as unknown as CreateEstimateCommand,
    });

    expect(result).toEqual({ kind: "created", estimate: sentinel });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ taxRate: 0.1 }));
  });

  it("税率が不一致のとき、作成せず両税率を載せた taxRateMismatch を返す", async () => {
    const execute = vi.fn();
    const estimateDateRate = new TaxRate(0.08);
    const deadlineRate = new TaxRate(0.1);
    const check = vi.fn().mockResolvedValue({ kind: "mismatch", estimateDateRate, deadlineRate });

    const result = await checkTaxRateThenCreate(inputFixture(), {
      taxRateConsistencyCheck: { check } as unknown as TaxRateConsistencyCheckDomainService,
      createCommand: { execute } as unknown as CreateEstimateCommand,
    });

    expect(result).toEqual({ kind: "taxRateMismatch", estimateDateRate, deadlineRate });
    expect(execute).not.toHaveBeenCalled();
  });
});
