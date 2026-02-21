import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { CompanyType } from "@generated/prisma/client";
import { PrismaCustomerQueryService } from "@subdomains/customer/infrastructure/queries/PrismaCustomerQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetAllCustomersQuery } from "../GetAllCustomersQuery";

describe("GetAllCustomersQuery", () => {
  let query: GetAllCustomersQuery;
  const testCompanyIds: string[] = [];

  const TEST_CODES = ["CUST999921", "CUST999922"];

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

    query = new GetAllCustomersQuery(new PrismaCustomerQueryService());
  });

  afterEach(async () => {
    if (testCompanyIds.length > 0) {
      await prisma.company.deleteMany({
        where: { id: { in: testCompanyIds } },
      });
    }
  });

  it("全得意先を取得できる", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "全取得得意先1" });
    await createTestCustomer({ code: TEST_CODES[1], name: "全取得得意先2" });

    const result = await query.execute();

    expect(result.length).toBeGreaterThanOrEqual(2);
    const codes = result.map((r) => r.code);
    expect(codes).toContain(TEST_CODES[0]);
    expect(codes).toContain(TEST_CODES[1]);
  });

  it("limit/offset付きで取得できる", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "全取得得意先3" });
    await createTestCustomer({ code: TEST_CODES[1], name: "全取得得意先4" });

    const result = await query.execute({ limit: 1 });

    expect(result.length).toBe(1);
  });

  it("ソート順を指定して取得できる", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "全取得得意先5" });
    await createTestCustomer({ code: TEST_CODES[1], name: "全取得得意先6" });

    // 直近作成のレコードのみ取得して並び順を検証
    const result = await query.execute({
      limit: 2,
      orderBy: { field: "createdAt", direction: "desc" },
    });

    expect(result.length).toBe(2);
    expect(result[0].createdAt.getTime()).toBeGreaterThanOrEqual(result[1].createdAt.getTime());
  });
});
