import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import {
  ensureCommonSellingPrice,
  ensurePricedProduct,
  giveCommonSellingPrice,
} from "@server/__tests__/helpers/sellingPriceScenario";
import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateNumberIssuer } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer";
import { resolveSellingPriceQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaTaxRateRepository";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CreateEstimateCommand, type CreateEstimateInput } from "../CreateEstimateCommand";
import { UpdateVariationCommand } from "../UpdateVariationCommand";

// 採番年度で隔離（ファイル専用年度。割り当て一覧は UpdateEstimateCommand.test.ts 参照）
const TEST_FISCAL_YEAR = 2094;

async function cleanupTestYear(): Promise<void> {
  await prisma.estimate.deleteMany({ where: { fiscalYear: TEST_FISCAL_YEAR } });
}

describe("UpdateVariationCommand", () => {
  let command: UpdateVariationCommand;
  let createCommand: CreateEstimateCommand;
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
    // 区分検証テスト（ADR-0052）で SET 商品を構成明細に混ぜる。価格決定は区分検証の前に走るため、
    // SET 商品にも解決可能な共通単価を与えておかないと「解決不能」で先に落ち、区分検証まで到達しない。
    await ensureCommonSellingPrice(ids.setProductId, { yen: 500 });
  });

  beforeEach(async () => {
    repository = new PrismaEstimateRepository();
    command = new UpdateVariationCommand(
      repository,
      new TaxRateConsistencyCheckDomainService(new PrismaTaxRateRepository()),
      new PrismaProductQueryService(),
      resolveSellingPriceQueryFactory()
    );
    createCommand = new CreateEstimateCommand(
      repository,
      new PrismaEstimateNumberIssuer(),
      resolveSellingPriceQueryFactory()
    );
    await cleanupTestYear();
  });

  afterAll(async () => {
    await cleanupTestYear();
  });

  function createInput(overrides: Partial<CreateEstimateInput> = {}): CreateEstimateInput {
    return {
      estimateType: "NEW",
      estimateDate: new Date("2094-04-01T00:00:00.000Z"),
      deadline: new Date("2094-04-30T00:00:00.000Z"),
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
              productId: ids.productId,
              sortOrder: 1,
              itemName: "商品A",
              quantity: 1,
              unit: "個",
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("バリエーション内容を全置換し、単価はマスタ解決で saved 永続化される", async () => {
    const created = await createCommand.execute(createInput());
    const variationId = created.variations[0].id.value;

    const result = await command.execute({
      estimateId: created.id.value,
      variationId,
      version: 1,
      content: {
        items: [
          {
            productId: ids.productId,
            sortOrder: 1,
            itemName: "商品B",
            quantity: 2,
            unit: "個",
          },
          {
            productId: ids.productId,
            sortOrder: 2,
            itemName: "商品C",
            quantity: 1,
            unit: "個",
          },
        ],
        overallDiscount: 400,
      },
    });

    expect(result.kind).toBe("saved");

    const found = await new PrismaEstimateRepository().findById(created.id);
    const variation = found?.variations.find((v) => v.id.value === variationId);
    expect(variation?.items).toHaveLength(2);
    // 単価は入力に無く、フィクスチャ商品の共通販売単価 1000 円が解決される。1000×2 + 1000×1 = 3000
    expect(variation?.items[0]!.unitPrice.majorUnits).toBe(1000);
    expect(variation?.subtotal.majorUnits).toBe(3000);
    expect(variation?.overallDiscount.majorUnits).toBe(400);
  });

  it("無効状態のバリエーションは編集不可（§3.4・BusinessRuleViolationError）", async () => {
    const created = await createCommand.execute(createInput());
    const variationId = created.variations[0].id.value;

    // 直接ドメイン経由で無効化して永続化（C5 De/Activate はスコープ外のため）
    const loaded = await repository.findById(created.id);
    loaded!.deactivateVariation(created.variations[0].id);
    await repository.update(loaded!, 1);

    await expect(
      command.execute({
        estimateId: created.id.value,
        variationId,
        version: 2, // 直前の無効化更新で 1 → 2 に進んでいる
        content: {
          items: [
            {
              productId: ids.productId,
              sortOrder: 1,
              itemName: "X",
              quantity: 1,
              unit: "個",
            },
          ],
        },
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("セット群を含む内容を保存でき、再読込で群と構成明細が復元される（S5 書込チェーン）", async () => {
    const created = await createCommand.execute(createInput());
    const variationId = created.variations[0].id.value;

    const result = await command.execute({
      estimateId: created.id.value,
      variationId,
      version: 1,
      content: {
        items: [
          {
            productId: ids.productId,
            sortOrder: 3,
            itemName: "通常明細",
            quantity: 1,
            unit: "個",
          },
        ],
        setGroups: [
          {
            productId: ids.setProductId,
            itemName: "セット商品",
            unit: "式",
            components: [
              {
                productId: ids.productId,
                sortOrder: 1,
                itemName: "構成1",
                quantity: 1,
                unit: "個",
              },
              {
                productId: ids.productId,
                sortOrder: 2,
                itemName: "構成2",
                quantity: 2,
                unit: "個",
              },
            ],
          },
        ],
      },
    });

    expect(result.kind).toBe("saved");

    const found = await new PrismaEstimateRepository().findById(created.id);
    const variation = found?.variations.find((v) => v.id.value === variationId);
    // 通常 1 + 構成 2 = 3 明細、セット群 1
    expect(variation?.items).toHaveLength(3);
    expect(variation?.setGroups).toHaveLength(1);
    // 全明細が同一フィクスチャ商品（1000円/個）で解決される。
    // 群の金額導出 = 構成合計（1000×1 + 1000×2 = 3000）
    const group = variation!.setGroups[0];
    expect(variation!.deriveSetGroup(group.id).amount.majorUnits).toBe(3000);
    // subtotal は全明細合計（1000 + 1000 + 2000 = 4000。構成の二重計上なし）
    expect(variation?.subtotal.majorUnits).toBe(4000);
  });

  it("構成にセット商品（SET 区分）を混ぜると区分検証で弾く（ADR-0052 ペイロード防御）", async () => {
    const created = await createCommand.execute(createInput());
    const variationId = created.variations[0].id.value;

    await expect(
      command.execute({
        estimateId: created.id.value,
        variationId,
        version: 1,
        content: {
          items: [],
          setGroups: [
            {
              productId: ids.setProductId,
              itemName: "セット商品",
              unit: "式",
              components: [
                {
                  // SET 区分商品を構成に指定（ネスト禁止違反）
                  productId: ids.setProductId,
                  sortOrder: 1,
                  itemName: "不正構成",
                  quantity: 1,
                  unit: "個",
                },
              ],
            },
          ],
        },
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("既存行（itemId一致・productId不変）はマスタ改定後も永続単価を保全する（ADR-20260709-5ea）", async () => {
    // 作成時にマスタ 1000 円で確定した明細を用意する。
    const pid = await ensurePricedProduct({ code: "UPDV430P", yen: 1000 });
    const created = await createCommand.execute(
      createInput({
        variations: [
          {
            variationNumber: 1,
            submissionType: "CUSTOMER",
            items: [{ productId: pid, sortOrder: 1, itemName: "商品P", quantity: 1, unit: "個" }],
          },
        ],
      })
    );
    const variationId = created.variations[0].id.value;
    const existingItemId = created.variations[0].items[0].id.value;
    expect(created.variations[0].items[0].unitPrice.majorUnits).toBe(1000);

    // マスタ単価を 2000 円へ改定する。既存行を保全するなら再解決されない。
    await giveCommonSellingPrice(pid, { yen: 2000 });

    const result = await command.execute({
      estimateId: created.id.value,
      variationId,
      version: 1,
      content: {
        items: [
          {
            itemId: existingItemId,
            productId: pid,
            sortOrder: 1,
            itemName: "商品P",
            quantity: 1,
            unit: "個",
          },
        ],
      },
    });

    expect(result.kind).toBe("saved");
    const found = await repository.findById(created.id);
    const variation = found?.variations.find((v) => v.id.value === variationId);
    // 既存行は改定前の 1000 を保全（2000 へ再解決されない）。
    expect(variation?.items[0]!.unitPrice.majorUnits).toBe(1000);
  });

  it("商品を変更した行・新規行はマスタ現在値で再解決される（保全対象外）", async () => {
    const pidX = await ensurePricedProduct({ code: "UPDV430X", yen: 1000 });
    const pidY = await ensurePricedProduct({ code: "UPDV430Y", yen: 500 });
    const created = await createCommand.execute(
      createInput({
        variations: [
          {
            variationNumber: 1,
            submissionType: "CUSTOMER",
            items: [{ productId: pidX, sortOrder: 1, itemName: "商品X", quantity: 1, unit: "個" }],
          },
        ],
      })
    );
    const variationId = created.variations[0].id.value;
    const existingItemId = created.variations[0].items[0].id.value;

    // pidX のマスタを 2000 へ改定。新規行の再解決を 2000 で検出する。
    await giveCommonSellingPrice(pidX, { yen: 2000 });

    const result = await command.execute({
      estimateId: created.id.value,
      variationId,
      version: 1,
      content: {
        items: [
          // 既存 itemId だが productId を pidY へ変更 → 保全対象外。pidY のマスタ 500 で再解決。
          {
            itemId: existingItemId,
            productId: pidY,
            sortOrder: 1,
            itemName: "商品Y",
            quantity: 1,
            unit: "個",
          },
          // itemId 無しの新規行 → pidX の現在マスタ 2000 で解決。
          { productId: pidX, sortOrder: 2, itemName: "商品X2", quantity: 1, unit: "個" },
        ],
      },
    });

    expect(result.kind).toBe("saved");
    const found = await repository.findById(created.id);
    const variation = found?.variations.find((v) => v.id.value === variationId);
    const byName = (name: string) => variation?.items.find((i) => i.itemName.value === name);
    // 商品変更行は改定後の pidY マスタ 500 で再解決（旧 1000 を保全しない）。
    expect(byName("商品Y")?.unitPrice.majorUnits).toBe(500);
    // 新規行は pidX の現在マスタ 2000 で解決。
    expect(byName("商品X2")?.unitPrice.majorUnits).toBe(2000);
  });

  it("不一致・偽造 itemId の行は新規行扱いで再解決される（ADR-20260709-5ea）", async () => {
    const pid = await ensurePricedProduct({ code: "UPDV430F", yen: 1000 });
    const created = await createCommand.execute(
      createInput({
        variations: [
          {
            variationNumber: 1,
            submissionType: "CUSTOMER",
            items: [{ productId: pid, sortOrder: 1, itemName: "商品F", quantity: 1, unit: "個" }],
          },
        ],
      })
    );
    const variationId = created.variations[0].id.value;

    // マスタを 2000 へ改定。偽造 itemId が保全されず再解決されることを 2000 で検出する。
    await giveCommonSellingPrice(pid, { yen: 2000 });

    const result = await command.execute({
      estimateId: created.id.value,
      variationId,
      version: 1,
      content: {
        items: [
          // 現行集約に存在しない itemId（偽造/不一致）。突合できず新規行として再解決される。
          {
            itemId: "00000000-0000-7000-8000-0000000004ff",
            productId: pid,
            sortOrder: 1,
            itemName: "商品F",
            quantity: 1,
            unit: "個",
          },
        ],
      },
    });

    expect(result.kind).toBe("saved");
    const found = await repository.findById(created.id);
    const variation = found?.variations.find((v) => v.id.value === variationId);
    // 偽造 itemId は保全されず現在マスタ 2000 で再解決される。
    expect(variation?.items[0]!.unitPrice.majorUnits).toBe(2000);
  });

  it("存在しない見積IDは NotFoundEntityError", async () => {
    await expect(
      command.execute({
        estimateId: "00000000-0000-7000-8000-0000000009ff",
        variationId: "00000000-0000-7000-8000-0000000009fe",
        version: 1,
        content: { items: [] },
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
