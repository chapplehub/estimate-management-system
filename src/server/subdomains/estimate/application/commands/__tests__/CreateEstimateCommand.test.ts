import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import { ensurePricedProduct } from "@server/__tests__/helpers/sellingPriceScenario";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { resolveSellingPriceQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import { PrismaEstimateNumberIssuer } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { ProductCategory, ProductUnit } from "@generated/prisma/enums";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CreateEstimateCommand, type CreateEstimateInput } from "../CreateEstimateCommand";

// 採番は「年度 × 種別の全行」を集約対象とするため年度単位で隔離する。
// 2097 は他テスト（リポジトリ=2099 / 採番=2098 帯）・実シードと衝突しない未使用年度。
// estimateDate を 2097-04-01（JST で 2097 年度）とすることで採番年度が 2097 に固定される。
const TEST_FISCAL_YEAR = 2097;

// このファイル固有の商品コード（並列実行時に他ファイルと販売単価で衝突しないよう固有接頭辞で確保）。
const PRODUCT_A_CODE = "C1P430A"; // 共通販売単価 1000 円
const PRODUCT_B_CODE = "C1P430B"; // 共通販売単価 500 円
const UNPRICED_PRODUCT_CODE = "C1P430U"; // 販売単価を持たない（解決不能検証用）

async function cleanupTestYear(): Promise<void> {
  await prisma.estimate.deleteMany({ where: { fiscalYear: TEST_FISCAL_YEAR } });
}

describe("CreateEstimateCommand", () => {
  let command: CreateEstimateCommand;
  let ids: EstimateFixtureIds;
  let productAId: string;
  let productBId: string;
  let unpricedProductId: string;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();

    // 見積単価は入力ではなくマスタ（販売単価）から解決される（ADR-0064）。異なる金額の明細を
    // 検証できるよう、2商品に別々の共通販売単価を与える。
    productAId = await ensurePricedProduct({ code: PRODUCT_A_CODE, yen: 1000 });
    productBId = await ensurePricedProduct({ code: PRODUCT_B_CODE, yen: 500 });

    // 販売単価を持たない商品（解決不能＝作成拒否の検証用）。
    const unpriced = await prisma.product.upsert({
      where: { code: UNPRICED_PRODUCT_CODE },
      update: {},
      create: {
        id: generateId(),
        code: UNPRICED_PRODUCT_CODE,
        name: "C1 販売単価なし商品",
        category: ProductCategory.INDIVIDUAL,
        unit: ProductUnit.PIECE,
      },
    });
    unpricedProductId = unpriced.id;
    await prisma.commonSellingPrice.deleteMany({ where: { productId: unpricedProductId } });
  });

  beforeEach(async () => {
    command = new CreateEstimateCommand(
      new PrismaEstimateRepository(),
      new PrismaEstimateNumberIssuer(),
      resolveSellingPriceQueryFactory()
    );
    await cleanupTestYear();
  });

  afterAll(async () => {
    await cleanupTestYear();
  });

  function baseInput(overrides: Partial<CreateEstimateInput> = {}): CreateEstimateInput {
    return {
      estimateType: "NEW",
      estimateDate: new Date("2097-04-01T00:00:00.000Z"),
      deadline: new Date("2097-04-30T00:00:00.000Z"),
      customerId: ids.customerId,
      deliveryLocationId: ids.deliveryLocationId,
      taxRate: 0.1,
      taxRoundingType: "ROUND_DOWN",
      createdBy: ids.employeeId,
      departmentId: ids.departmentId,
      variations: [
        {
          variationNumber: 1,
          submissionType: "CUSTOMER",
          items: [
            {
              productId: productAId,
              sortOrder: 1,
              itemName: "商品A",
              quantity: 2,
              unit: "個",
            },
            {
              productId: productBId,
              sortOrder: 2,
              itemName: "商品B",
              quantity: 1,
              unit: "個",
              revisedDeliveryPrice: 800,
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("NEW: 単価は入力せずマスタから解決され、金額集計と明細・改訂明細詳細が永続化される", async () => {
    const created = await command.execute(baseInput());

    // 採番結果（保存時採番 §2.3・MAX+1 で連番1）
    expect(created.estimateNumber.value).toBe("N9700001");
    expect(created.fiscalYear.value).toBe(TEST_FISCAL_YEAR);
    expect(created.sequence).toBe(1);

    // DB から再取得して永続化を確認
    const repository = new PrismaEstimateRepository();
    const found = await repository.findById(created.id);
    expect(found).not.toBeNull();
    if (!found) return;

    expect(found.estimateType.value).toBe("NEW");
    expect(found.variations).toHaveLength(1);
    const variation = found.variations[0];
    // 明細単価はマスタ解決値（商品A=1000 / 商品B=500）で確定する。
    expect(variation.items[0].unitPrice.majorUnits).toBe(1000);
    expect(variation.items[1].unitPrice.majorUnits).toBe(500);
    // 1000*2 + 500*1 = 2500
    expect(variation.subtotal.majorUnits).toBe(2500);
    expect(variation.items).toHaveLength(2);
    expect(variation.items[1].revisedDetail?.deliveryPrice.majorUnits).toBe(800);
  });

  it("販売単価のない商品を選ぶと解決不能で作成が拒否され、見積は永続化されない（ADR-0064）", async () => {
    await expect(
      command.execute(
        baseInput({
          variations: [
            {
              variationNumber: 1,
              submissionType: "CUSTOMER",
              items: [
                {
                  productId: unpricedProductId,
                  sortOrder: 1,
                  itemName: "販売単価なし商品",
                  quantity: 1,
                  unit: "個",
                },
              ],
            },
          ],
        })
      )
    ).rejects.toThrow(BusinessRuleViolationError);

    // 解決は採番・永続化より前に行われるため、拒否時は見積が1件も作られない。
    const remaining = await prisma.estimate.count({ where: { fiscalYear: TEST_FISCAL_YEAR } });
    expect(remaining).toBe(0);
  });

  it("バリエーションごとの提出区分で作成でき、納品先宛と得意先宛が同一見積内に共存して永続化される（ADR-0045）", async () => {
    const created = await command.execute(
      baseInput({
        variations: [
          {
            variationNumber: 1,
            submissionType: "DELIVERY_LOCATION",
            items: [
              {
                productId: productAId,
                sortOrder: 1,
                itemName: "商品A",
                quantity: 1,
                unit: "個",
              },
            ],
          },
          {
            variationNumber: 2,
            submissionType: "CUSTOMER",
            items: [
              {
                productId: productBId,
                sortOrder: 1,
                itemName: "商品B",
                quantity: 1,
                unit: "個",
              },
            ],
          },
        ],
      })
    );

    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.variations).toHaveLength(2);
    expect(found?.variations[0].submissionType.isDeliveryLocation()).toBe(true);
    expect(found?.variations[1].submissionType.isCustomer()).toBe(true);
  });

  it("連続作成で連番が +1 される（保存時採番 §2.3・MAX+1）", async () => {
    const first = await command.execute(baseInput());
    const second = await command.execute(baseInput());

    expect(first.estimateNumber.value).toBe("N9700001");
    expect(second.estimateNumber.value).toBe("N9700002");
    expect(second.sequence).toBe(2);
  });

  it("REPAIR: repairDetail を伴って作成・永続化でき、種別ごとに連番1から採番される", async () => {
    const created = await command.execute(
      baseInput({
        estimateType: "REPAIR",
        repairDetail: {
          targetProductId: productAId,
          faultDescription: "電源が入らない",
          scheduledRepairDate: new Date("2097-05-10T00:00:00.000Z"),
        },
      })
    );

    expect(created.estimateNumber.value).toBe("R9700001");

    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.estimateType.value).toBe("REPAIR");
    expect(found?.repairDetail?.faultDescription.value).toBe("電源が入らない");
    expect(found?.afterRepairDetail).toBeNull();
  });

  it("AFTER_REPAIR: afterRepairDetail を伴って作成・永続化できる", async () => {
    const created = await command.execute(
      baseInput({
        estimateType: "AFTER_REPAIR",
        afterRepairDetail: {
          targetProductId: productAId,
          faultDescription: "基板焼損",
          actualRepairDate: new Date("2097-03-20T00:00:00.000Z"),
          emergencyReason: "顧客ライン停止のため緊急対応",
        },
      })
    );

    expect(created.estimateNumber.value).toBe("A9700001");

    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.estimateType.value).toBe("AFTER_REPAIR");
    expect(found?.afterRepairDetail?.emergencyReason.value).toBe("顧客ライン停止のため緊急対応");
    expect(found?.repairDetail).toBeNull();
  });

  it("バリエーション0件は空見積不可で BusinessRuleViolationError", async () => {
    await expect(command.execute(baseInput({ variations: [] }))).rejects.toThrow(
      BusinessRuleViolationError
    );
  });
});
