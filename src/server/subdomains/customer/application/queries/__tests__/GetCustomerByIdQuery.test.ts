import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import { PrismaCustomerQueryService } from "@subdomains/customer/infrastructure/queries/PrismaCustomerQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetCustomerByIdQuery } from "../GetCustomerByIdQuery";

describe("GetCustomerByIdQuery", () => {
  let query: GetCustomerByIdQuery;
  const testCustomerIds: string[] = [];

  const TEST_CODES = ["CUST999923"];

  async function createTestCustomer(data: { code: string; name: string; marginRate?: number }) {
    const customerId = generateId();

    await prisma.customer.create({
      data: {
        id: customerId,
        code: data.code,
        name: data.name,
        isActive: true,
        marginRate: data.marginRate ?? null,
      },
    });

    testCustomerIds.push(customerId);
    return { customerId };
  }

  beforeEach(async () => {
    testCustomerIds.length = 0;

    await prisma.customer.deleteMany({
      where: { code: { in: TEST_CODES } },
    });

    query = new GetCustomerByIdQuery(new PrismaCustomerQueryService());
  });

  afterEach(async () => {
    if (testCustomerIds.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: testCustomerIds } },
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
    const result = await query.execute({ id: "00000000-0000-7000-8000-000000000000" });

    expect(result).toBeNull();
  });
});
