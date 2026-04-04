import { generateId } from "@server/shared/generateId";
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
    isActive?: boolean;
    customerId?: string;
  }) {
    const companyId = generateId();
    const dlId = generateId();

    await prisma.company.create({
      data: {
        id: companyId,
        code: data.code,
        name: data.name,
        type: CompanyType.DELIVERY_LOCATION,
        isActive: data.isActive ?? true,
      },
    });

    await prisma.deliveryLocation.create({
      data: {
        id: dlId,
        companyId,
        customerId: data.customerId ?? testCustomerId,
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
    customerCompanyId = generateId();
    testCustomerId = generateId();

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

  it("名前で検索してヒットしない場合は空配列を返す", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "SQ検索納品先A" });

    const result = await query.execute({ name: "該当なしSQ名前" });

    expect(result).toEqual([]);
  });

  it("コードで検索できる（完全一致）", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "コード検索DL-A" });
    await createTestDeliveryLocation({ code: DL_TEST_CODES[1], name: "コード検索DL-B" });

    const result = await query.execute({ code: DL_TEST_CODES[0] });

    expect(result.length).toBe(1);
    expect(result[0].code).toBe(DL_TEST_CODES[0]);
  });

  it("コードで検索してヒットしない場合は空配列を返す", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "コード検索DL-A" });

    const result = await query.execute({ code: "NONEXIST999" });

    expect(result).toEqual([]);
  });

  it("コードの部分一致ではヒットしない", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "部分一致テスト" });

    const result = await query.execute({ code: DL_TEST_CODES[0].slice(0, 4) });

    expect(result).toEqual([]);
  });

  it("customerIdで検索できる", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "得意先ID検索A" });
    await createTestDeliveryLocation({ code: DL_TEST_CODES[1], name: "得意先ID検索B" });

    const result = await query.execute({ customerId: testCustomerId });

    expect(result.length).toBe(2);
    for (const dl of result) {
      expect(dl.customerId).toBe(testCustomerId);
    }
  });

  it("customerIdで検索してヒットしない場合は空配列を返す", async () => {
    await createTestDeliveryLocation({ code: DL_TEST_CODES[0], name: "得意先ID検索C" });

    const result = await query.execute({ customerId: "non-existent-customer-id" });

    expect(result).toEqual([]);
  });

  it("isActiveで検索できる", async () => {
    await createTestDeliveryLocation({
      code: DL_TEST_CODES[0],
      name: "SQアクティブ納品先",
      isActive: true,
    });
    await createTestDeliveryLocation({
      code: DL_TEST_CODES[1],
      name: "SQアクティブ納品先",
      isActive: false,
    });

    const activeResult = await query.execute({ name: "SQアクティブ納品先", isActive: true });
    expect(activeResult.length).toBe(1);
    expect(activeResult[0].code).toBe(DL_TEST_CODES[0]);

    const inactiveResult = await query.execute({ name: "SQアクティブ納品先", isActive: false });
    expect(inactiveResult.length).toBe(1);
    expect(inactiveResult[0].code).toBe(DL_TEST_CODES[1]);
  });

  it("複数条件を組み合わせて検索できる", async () => {
    await createTestDeliveryLocation({
      code: DL_TEST_CODES[0],
      name: "複合検索納品先A",
      isActive: true,
    });
    await createTestDeliveryLocation({
      code: DL_TEST_CODES[1],
      name: "複合検索納品先B",
      isActive: false,
    });
    await createTestDeliveryLocation({
      code: DL_TEST_CODES[2],
      name: "別名納品先C",
      isActive: true,
    });

    const result = await query.execute({
      name: "複合検索",
      code: DL_TEST_CODES[0],
      customerId: testCustomerId,
      isActive: true,
    });

    expect(result.length).toBe(1);
    expect(result[0].code).toBe(DL_TEST_CODES[0]);
    expect(result[0].name).toBe("複合検索納品先A");
  });
});
