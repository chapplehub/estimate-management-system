import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import { PrismaDeliveryLocationQueryService } from "@subdomains/delivery-location/infrastructure/queries/PrismaDeliveryLocationQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetDeliveryLocationByIdQuery } from "../GetDeliveryLocationByIdQuery";

describe("GetDeliveryLocationByIdQuery", () => {
  let query: GetDeliveryLocationByIdQuery;
  const testDeliveryLocationIds: string[] = [];
  let testCustomerId: string;

  const DL_TEST_CODES = ["DL999921"];
  const CUSTOMER_TEST_CODE = "CUST999941";

  async function createTestDeliveryLocation(data: {
    code: string;
    name: string;
    deliveryNotes?: string;
  }) {
    const dlId = generateId();

    await prisma.deliveryLocation.create({
      data: {
        id: dlId,
        code: data.code,
        name: data.name,
        isActive: true,
        customerId: testCustomerId,
        deliveryNotes: data.deliveryNotes ?? null,
      },
    });

    testDeliveryLocationIds.push(dlId);
    return { dlId };
  }

  beforeEach(async () => {
    testDeliveryLocationIds.length = 0;

    await prisma.deliveryLocation.deleteMany({
      where: { code: { in: DL_TEST_CODES } },
    });
    await prisma.customer.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });

    // テスト用得意先をDB直接投入
    testCustomerId = generateId();

    await prisma.customer.create({
      data: {
        id: testCustomerId,
        code: CUSTOMER_TEST_CODE,
        name: "DLクエリテスト用得意先",
        isActive: true,
      },
    });

    query = new GetDeliveryLocationByIdQuery(new PrismaDeliveryLocationQueryService());
  });

  afterEach(async () => {
    if (testDeliveryLocationIds.length > 0) {
      await prisma.deliveryLocation.deleteMany({
        where: { id: { in: testDeliveryLocationIds } },
      });
    }
    await prisma.customer.deleteMany({
      where: { code: CUSTOMER_TEST_CODE },
    });
  });

  it("IDで納品先を取得できる", async () => {
    const { dlId } = await createTestDeliveryLocation({
      code: DL_TEST_CODES[0],
      name: "ID取得テスト納品先",
    });

    const result = await query.execute({ id: dlId });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(dlId);
    expect(result?.code).toBe(DL_TEST_CODES[0]);
    expect(result?.name).toBe("ID取得テスト納品先");
    expect(result?.customerId).toBe(testCustomerId);
  });

  it("存在しないIDの場合は null を返す", async () => {
    const result = await query.execute({ id: "00000000-0000-7000-8000-000000000000" });

    expect(result).toBeNull();
  });
});
