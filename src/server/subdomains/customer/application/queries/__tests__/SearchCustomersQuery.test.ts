import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { CompanyType } from "@generated/prisma/client";
import { PrismaCustomerQueryService } from "@subdomains/customer/infrastructure/queries/PrismaCustomerQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchCustomersQuery } from "../SearchCustomersQuery";

describe("SearchCustomersQuery", () => {
  let query: SearchCustomersQuery;
  const testCompanyIds: string[] = [];

  const TEST_CODES = ["CUST999924", "CUST999925", "CUST999926"];

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

    query = new SearchCustomersQuery(new PrismaCustomerQueryService());
  });

  afterEach(async () => {
    if (testCompanyIds.length > 0) {
      await prisma.company.deleteMany({
        where: { id: { in: testCompanyIds } },
      });
    }
  });

  it("名前で検索できる（部分一致）", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "SQ検索得意先A" });
    await createTestCustomer({ code: TEST_CODES[1], name: "SQ検索得意先B" });

    const result = await query.execute({ name: "SQ検索得意先" });

    expect(result.length).toBe(2);
    const names = result.map((r) => r.name);
    expect(names).toContain("SQ検索得意先A");
    expect(names).toContain("SQ検索得意先B");
  });

  it("コードで検索できる（完全一致）", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "コード検索A" });
    await createTestCustomer({ code: TEST_CODES[1], name: "コード検索B" });

    const result = await query.execute({ code: TEST_CODES[0] });

    expect(result.length).toBe(1);
    expect(result[0].code).toBe(TEST_CODES[0]);
  });

  it("条件に一致する得意先がない場合は空配列を返す", async () => {
    const result = await query.execute({ name: "存在しないSQ得意先名" });

    expect(result).toEqual([]);
  });
});
