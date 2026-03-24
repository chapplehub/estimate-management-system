import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { CompanyType } from "@generated/prisma/client";
import { PrismaDeliveryLocationQueryService } from "@subdomains/delivery-location/infrastructure/queries/PrismaDeliveryLocationQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetDeliveryLocationsByCustomerIdQuery } from "../GetDeliveryLocationsByCustomerIdQuery";

describe("GetDeliveryLocationsByCustomerIdQuery", () => {
  let query: GetDeliveryLocationsByCustomerIdQuery;
  const testCompanyIds: string[] = [];
  let testCustomerId: string;
  let customerCompanyId: string;

  const DL_TEST_CODES = ["DL999922", "DL999923"];
  const CUSTOMER_TEST_CODE = "CUST999942";

  async function createTestDeliveryLocation(data: {
    code: string;
    name: string;
    deliveryNotes?: string;
  }) {
    const companyId = createId();
    const dlId = createId();

    await prisma.company.create({
      data: {
        id: companyId,
        code: data.code,
        name: data.name,
        type: CompanyType.DELIVERY_LOCATION,
        isActive: true,
      },
    });

    await prisma.deliveryLocation.create({
      data: {
        id: dlId,
        companyId,
        customerId: testCustomerId,
        deliveryNotes: data.deliveryNotes ?? null,
      },
    });

    testCompanyIds.push(companyId);
    return { companyId, dlId };
  }

  beforeEach(async () => {
    testCompanyIds.length = 0;

    await prisma.company.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.company.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });

    // テスト用得意先をDB直接投入
    customerCompanyId = createId();
    testCustomerId = createId();

    await prisma.company.create({
      data: {
        id: customerCompanyId,
        code: CUSTOMER_TEST_CODE,
        name: "DL一覧クエリテスト用得意先",
        type: CompanyType.CUSTOMER,
        isActive: true,
      },
    });

    await prisma.customer.create({
      data: {
        id: testCustomerId,
        companyId: customerCompanyId,
      },
    });

    query = new GetDeliveryLocationsByCustomerIdQuery(new PrismaDeliveryLocationQueryService());
  });

  afterEach(async () => {
    if (testCompanyIds.length > 0) {
      await prisma.company.deleteMany({
        where: { id: { in: testCompanyIds } },
      });
    }
    await prisma.company.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });
  });

  it("得意先IDで納品先一覧を取得できる", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "一覧納品先A" });
    await createTestDeliveryLocation({ code: DL_TEST_CODES[1], name: "一覧納品先B" });

    const result = await query.execute({ customerId: testCustomerId });

    expect(result.length).toBe(2);
    const codes = result.map((r) => r.code);
    expect(codes).toContain(DL_TEST_CODES[0]);
    expect(codes).toContain(DL_TEST_CODES[1]);
    for (const dl of result) {
      expect(dl.customerId).toBe(testCustomerId);
    }
  });

  it("該当なしの場合は空配列を返す", async () => {
    const result = await query.execute({ customerId: "non-existent-customer-id" });

    expect(result).toEqual([]);
  });

  it("limit/offset付きで取得できる", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "ページ納品先A" });
    await createTestDeliveryLocation({ code: DL_TEST_CODES[1], name: "ページ納品先B" });

    const result = await query.execute({ customerId: testCustomerId }, { limit: 1 });

    expect(result.length).toBe(1);
  });
});
