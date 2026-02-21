import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { CompanyType } from "@generated/prisma/client";
import { PrismaCustomerQueryService } from "@subdomains/customer/infrastructure/queries/PrismaCustomerQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetCustomerByIdQuery } from "../GetCustomerByIdQuery";

describe("GetCustomerByIdQuery", () => {
  let query: GetCustomerByIdQuery;
  const testCompanyIds: string[] = [];

  const TEST_CODES = ["CUST999923"];

  async function createTestCustomer(data: { code: string; name: string; marginRate?: number }) {
    const companyId = createId();
    const customerId = createId();

    await prisma.company.create({
      data: {
        id: companyId,
        code: data.code,
        name: data.name,
        type: CompanyType.CUSTOMER,
        isActive: true,
      },
    });

    await prisma.customer.create({
      data: {
        id: customerId,
        companyId,
        marginRate: data.marginRate ?? null,
      },
    });

    testCompanyIds.push(companyId);
    return { companyId, customerId };
  }

  beforeEach(async () => {
    testCompanyIds.length = 0;

    await prisma.company.deleteMany({
      where: { code: { in: TEST_CODES } },
    });

    query = new GetCustomerByIdQuery(new PrismaCustomerQueryService());
  });

  afterEach(async () => {
    if (testCompanyIds.length > 0) {
      await prisma.company.deleteMany({
        where: { id: { in: testCompanyIds } },
      });
    }
  });

  it("IDで得意先を取得できる", async () => {
    const { customerId } = await createTestCustomer({
      code: TEST_CODES[0],
      name: "ID取得テスト得意先",
    });

    const result = await query.execute({ id: customerId });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(customerId);
    expect(result?.code).toBe(TEST_CODES[0]);
    expect(result?.name).toBe("ID取得テスト得意先");
  });

  it("存在しないIDの場合は null を返す", async () => {
    const result = await query.execute({ id: "non-existent-id" });

    expect(result).toBeNull();
  });
});
