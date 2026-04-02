import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { CompanyType } from "@generated/prisma/client";
import { PrismaCustomerQueryService } from "@subdomains/customer/infrastructure/queries/PrismaCustomerQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchCustomersQuery } from "../SearchCustomersQuery";

describe("SearchCustomersQuery", () => {
  let query: SearchCustomersQuery;
  const testCompanyIds: string[] = [];

  const TEST_CODES = ["CUST999924", "CUST999925", "CUST999926", "CUST999927"];

  async function createTestCustomer(data: {
    code: string;
    name: string;
    marginRate?: number;
    isActive?: boolean;
  }) {
    const companyId = createId();
    const customerId = createId();

    await prisma.company.create({
      data: {
        id: companyId,
        code: data.code,
        name: data.name,
        type: CompanyType.CUSTOMER,
        isActive: data.isActive ?? true,
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

  it("名前で検索してヒットしない場合は空配列を返す", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "SQ検索得意先A" });

    const result = await query.execute({ name: "該当なしSQ名前" });

    expect(result).toEqual([]);
  });

  it("コードで検索できる（完全一致）", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "コード検索A" });
    await createTestCustomer({ code: TEST_CODES[1], name: "コード検索B" });

    const result = await query.execute({ code: TEST_CODES[0] });

    expect(result.length).toBe(1);
    expect(result[0].code).toBe(TEST_CODES[0]);
  });

  it("コードで検索してヒットしない場合は空配列を返す", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "コード検索A" });

    const result = await query.execute({ code: "NONEXIST999" });

    expect(result).toEqual([]);
  });

  it("コードの部分一致ではヒットしない", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "部分一致テスト" });

    const result = await query.execute({ code: TEST_CODES[0].slice(0, 6) });

    expect(result).toEqual([]);
  });

  it("isActiveで検索できる", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "SQアクティブ得意先", isActive: true });
    await createTestCustomer({ code: TEST_CODES[1], name: "SQアクティブ得意先", isActive: false });

    const activeResult = await query.execute({ name: "SQアクティブ得意先", isActive: true });
    expect(activeResult.length).toBe(1);
    expect(activeResult[0].code).toBe(TEST_CODES[0]);

    const inactiveResult = await query.execute({ name: "SQアクティブ得意先", isActive: false });
    expect(inactiveResult.length).toBe(1);
    expect(inactiveResult[0].code).toBe(TEST_CODES[1]);
  });

  it("複数条件を組み合わせて検索できる", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "複合検索得意先A", isActive: true });
    await createTestCustomer({ code: TEST_CODES[1], name: "複合検索得意先B", isActive: false });
    await createTestCustomer({ code: TEST_CODES[2], name: "別名得意先C", isActive: true });

    const result = await query.execute({
      name: "複合検索",
      code: TEST_CODES[0],
      isActive: true,
    });

    expect(result.length).toBe(1);
    expect(result[0].code).toBe(TEST_CODES[0]);
    expect(result[0].name).toBe("複合検索得意先A");
  });

  it("createdAfterで指定日時以降の得意先を取得できる", async () => {
    const before = new Date();
    await createTestCustomer({ code: TEST_CODES[0], name: "SQ日付検索得意先A" });

    const result = await query.execute({ name: "SQ日付検索得意先", createdAfter: before });

    const codes = result.map((r) => r.code);
    expect(codes).toContain(TEST_CODES[0]);
  });

  it("createdAfterで指定日時以降に該当しない場合はヒットしない", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "SQ日付検索得意先B" });
    const future = new Date(Date.now() + 60_000);

    const result = await query.execute({ name: "SQ日付検索得意先", createdAfter: future });

    const codes = result.map((r) => r.code);
    expect(codes).not.toContain(TEST_CODES[0]);
  });

  it("createdBeforeで指定日時以前の得意先を取得できる", async () => {
    await createTestCustomer({ code: TEST_CODES[0], name: "SQ日付検索得意先C" });
    const after = new Date(Date.now() + 60_000);

    const result = await query.execute({ name: "SQ日付検索得意先", createdBefore: after });

    const codes = result.map((r) => r.code);
    expect(codes).toContain(TEST_CODES[0]);
  });

  it("createdBeforeで指定日時以前に該当しない場合はヒットしない", async () => {
    const past = new Date();
    // 少し待ってからレコード作成（pastより後に作成される）
    await new Promise((resolve) => setTimeout(resolve, 50));
    await createTestCustomer({ code: TEST_CODES[0], name: "SQ日付検索得意先D" });

    const result = await query.execute({ name: "SQ日付検索得意先", createdBefore: past });

    const codes = result.map((r) => r.code);
    expect(codes).not.toContain(TEST_CODES[0]);
  });
});
