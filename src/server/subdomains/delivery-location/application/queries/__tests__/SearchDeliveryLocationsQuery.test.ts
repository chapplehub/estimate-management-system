import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { CompanyType } from "@generated/prisma/client";
import { PrismaDeliveryLocationQueryService } from "@subdomains/delivery-location/infrastructure/queries/PrismaDeliveryLocationQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchDeliveryLocationsQuery } from "../SearchDeliveryLocationsQuery";

describe("SearchDeliveryLocationsQuery", () => {
  let query: SearchDeliveryLocationsQuery;
  const testCompanyIds: string[] = [];
  let testCustomerId: string;
  let customerCompanyId: string;

  const DL_TEST_CODES = ["DL999924", "DL999925", "DL999926"];
  const CUSTOMER_TEST_CODE = "CUST999943";

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
        name: "DL検索クエリテスト用得意先",
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

    query = new SearchDeliveryLocationsQuery(new PrismaDeliveryLocationQueryService());
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

  it("名前で検索できる（部分一致）", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "SQ検索納品先A" });
    await createTestDeliveryLocation({ code: DL_TEST_CODES[1], name: "SQ検索納品先B" });

    const result = await query.execute({ name: "SQ検索納品先" });

    expect(result.length).toBe(2);
    const names = result.map((r) => r.name);
    expect(names).toContain("SQ検索納品先A");
    expect(names).toContain("SQ検索納品先B");
  });

  it("コードで検索できる（完全一致）", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "コード検索DL-A" });
    await createTestDeliveryLocation({ code: DL_TEST_CODES[1], name: "コード検索DL-B" });

    const result = await query.execute({ code: DL_TEST_CODES[0] });

    expect(result.length).toBe(1);
    expect(result[0].code).toBe(DL_TEST_CODES[0]);
  });

  it("条件に一致する納品先がない場合は空配列を返す", async () => {
    const result = await query.execute({ name: "存在しないSQ納品先名" });

    expect(result).toEqual([]);
  });
});
