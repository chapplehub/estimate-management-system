import { TaxRateMaster } from "@subdomains/estimate/domain/entities/TaxRateMaster";
import type { TaxRateRepository } from "@subdomains/estimate/domain/repositories/TaxRateRepository";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRateMasterId } from "@subdomains/estimate/domain/values/TaxRateMasterId";
import { describe, expect, it, vi } from "vitest";
import { ResolveEffectiveTaxRateQuery } from "../ResolveEffectiveTaxRateQuery";

const MASTER_ID = "00000000-0000-7000-8000-0000000000f1";

describe("ResolveEffectiveTaxRateQuery", () => {
  it("有効税率が見つかれば税率値（number）を返す", async () => {
    const master = TaxRateMaster.reconstruct(
      new TaxRateMasterId(MASTER_ID),
      new TaxRate(0.1),
      new Date("2019-10-01T00:00:00+09:00")
    );
    const repository = {
      findEffectiveAt: vi.fn().mockResolvedValue(master),
    } as unknown as TaxRateRepository;

    const result = await new ResolveEffectiveTaxRateQuery(repository).execute({
      date: new Date("2026-06-17T00:00:00+09:00"),
    });

    expect(result).toBe(0.1);
  });

  it("有効税率が無ければ null を返す（マスタ最古行より前など）", async () => {
    const repository = {
      findEffectiveAt: vi.fn().mockResolvedValue(null),
    } as unknown as TaxRateRepository;

    const result = await new ResolveEffectiveTaxRateQuery(repository).execute({
      date: new Date("2000-01-01T00:00:00+09:00"),
    });

    expect(result).toBeNull();
  });
});
