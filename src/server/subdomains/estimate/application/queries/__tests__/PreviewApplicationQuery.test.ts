import {
  cleanupApprovalFixtures,
  ensureApprovalFixtures,
  type ApprovalFixtureIds,
} from "@server/__tests__/helpers/ensureApprovalFixtures";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { PrismaPositionQueryService } from "@subdomains/position/infrastructure/queries/PrismaPositionQueryService";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import {
  buildNewEstimate,
  makeItem,
} from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { tryResolveSellingPriceQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import {
  ensurePricedProduct,
  giveCommonSellingPrice,
} from "@server/__tests__/helpers/sellingPriceScenario";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PreviewApplicationQuery } from "../PreviewApplicationQuery";

/**
 * 申請プレビュークエリの統合テスト（#417・実 Prisma・モック禁止）。
 * 組織はシードの正準マスタ（POS/ROLE 系）を再利用し、申請操作者の上位役割を営業一課長に設定する。
 */
describe("PreviewApplicationQuery", () => {
  // 承認系テスト見積番号（免除/申請テストと帯を分けて N9908xxx を使う）。
  const EN = {
    exempt: "N9908001",
    required: "N9908002",
    noSuperior: "N9908003",
    sideEffect: "N9908004",
    inactive: "N9908005",
    warnDivergent: "N9908006",
    warnNone: "N9908007",
    warnUnresolvable: "N9908008",
  } as const;
  const ALL_NUMBERS = Object.values(EN);
  const OPERATOR_CD = "EMP999096";

  let query: PreviewApplicationQuery;
  let estimateRepository: PrismaEstimateRepository;
  let ids: ApprovalFixtureIds;
  /** 上位役割＝営業一課長（ROLE009）を持つ申請操作者。 */
  let operatorId: string;

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
    // 申請操作者は課員（担当役割なし）。承認起点は明示上位役割行から導出される（ADR-20260707-k4e）
    const operator = await prisma.employee.upsert({
      where: { employeeCd: OPERATOR_CD },
      update: {
        superiorRole: {
          upsert: {
            create: { roleId: ids.stepRoleIds[0] },
            update: { roleId: ids.stepRoleIds[0] },
          },
        },
      },
      create: {
        id: generateId(),
        employeeCd: OPERATOR_CD,
        email: "preview-operator@example.com",
        name: "申請操作者",
        departmentId: ids.estimate.departmentId,
        superiorRole: { create: { roleId: ids.stepRoleIds[0] } },
      },
    });
    operatorId = operator.id;
  });

  beforeEach(async () => {
    estimateRepository = new PrismaEstimateRepository();
    query = new PreviewApplicationQuery(
      estimateRepository,
      new PrismaProductQueryService(),
      new PrismaEmployeeQueryService(),
      new PrismaPositionQueryService(),
      new PrismaRoleQueryService(),
      tryResolveSellingPriceQueryFactory()
    );
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  afterAll(async () => {
    await cleanupApprovalFixtures(ALL_NUMBERS);
    await prisma.employee.deleteMany({ where: { employeeCd: OPERATOR_CD } });
  });

  it("10万円未満の見積は EXEMPT(BELOW_THRESHOLD) を返す", async () => {
    const estimate = await estimateRepository.insert(buildNewEstimate(ids.estimate, EN.exempt));

    const result = await query.execute({
      estimateId: estimate.id.value,
      variationId: estimate.variations[0].id.value,
      operatorEmployeeId: operatorId,
    });

    // 承認判定は EXEMPT。単価警告は別テストで検証するためここでは approval フィールドのみ確認する。
    expect(result).toMatchObject({
      kind: "EXEMPT",
      reason: "BELOW_THRESHOLD",
      reasonLabel: "10万円未満",
    });
  });

  it("100万円超の見積は REQUIRED で起点→ゴール順のステップ列を返す", async () => {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, EN.required, {
        items: [
          makeItem(ids.estimate.productId, { sortOrder: 1, unitPrice: 1_000_000, quantity: 1 }),
        ],
      })
    );

    const result = await query.execute({
      estimateId: estimate.id.value,
      variationId: estimate.variations[0].id.value,
      operatorEmployeeId: operatorId,
    });

    expect(result.kind).toBe("REQUIRED");
    if (result.kind !== "REQUIRED") throw new Error(`expected REQUIRED, got ${result.kind}`);
    // 部長ゴール（POS002）まで 営業一課長 → 営業部長 の2段。
    expect(result.goalPositionId).toBe(ids.goalPositionId);
    expect(result.goalPositionName).toBe("部長");
    expect(result.steps).toEqual([
      { order: 1, roleName: "営業一課長", positionName: "課長" },
      { order: 2, roleName: "営業部長", positionName: "部長" },
    ]);
  });

  it("上位役割が未設定の操作者では BLOCKED(NO_SUPERIOR_ROLE) を返す", async () => {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, EN.noSuperior, {
        items: [
          makeItem(ids.estimate.productId, { sortOrder: 1, unitPrice: 1_000_000, quantity: 1 }),
        ],
      })
    );

    const result = await query.execute({
      estimateId: estimate.id.value,
      variationId: estimate.variations[0].id.value,
      // ensureEstimateFixtures の見積作成者は上位役割を持たない。
      operatorEmployeeId: ids.estimate.employeeId,
    });

    expect(result).toEqual({
      kind: "BLOCKED",
      reason: "NO_SUPERIOR_ROLE",
      reasonLabel: "申請者に上位役割が設定されていないため申請できません",
    });
  });

  it("INACTIVE バリエーションは judge を走らせず INACTIVE を返す（Submit と可否一致）", async () => {
    // 複数バリエーションで対象を無効化する（Submit テストと同じ手順）。
    // INACTIVE 判定は judge より前で弾くため金額は不問。
    const built = buildNewEstimate(ids.estimate, EN.inactive, { variationNumbers: [1, 2] });
    const targetVariation = built.variations[1];
    built.deactivateVariation(targetVariation.id);
    const estimate = await estimateRepository.insert(built);
    const variationId = targetVariation.id.value;

    const result = await query.execute({
      estimateId: estimate.id.value,
      variationId,
      operatorEmployeeId: operatorId,
    });

    // Submit（無効なバリエーションには申請できない）と可否が一致する。
    expect(result).toEqual({
      kind: "INACTIVE",
      label: "このバリエーションは無効化されています。画面を更新して最新の状態をご確認ください。",
    });

    // 副作用なし（クエリのため申請行・免除行を作らない）。
    const applications = await prisma.estimateApplication.count({ where: { variationId } });
    const exemptions = await prisma.estimateApprovalExemption.count({ where: { variationId } });
    expect(applications).toBe(0);
    expect(exemptions).toBe(0);
  });

  describe("単価乖離・解決不能の警告件数（#593）", () => {
    // 見積年月日（buildNewEstimate 既定）は 2025-04-01。この日を含む期間で master 値を制御する。
    const WARN_PRODUCT_CODE = "PRWARN59301";
    const ESTIMATE_DATE = "2025-04-01";
    let warnProductId: string;

    beforeEach(async () => {
      warnProductId = await ensurePricedProduct({
        code: WARN_PRODUCT_CODE,
        yen: 1000,
        start: ESTIMATE_DATE,
        today: ESTIMATE_DATE,
      });
    });

    it("乖離明細があるバリの preview（EXEMPT）に乖離件数が載る", async () => {
      // 固定単価 1000・現在マスタ 1200 → 乖離1件。金額は 10万円未満で EXEMPT。
      await giveCommonSellingPrice(warnProductId, {
        yen: 1200,
        start: ESTIMATE_DATE,
        today: ESTIMATE_DATE,
      });
      const estimate = await estimateRepository.insert(
        buildNewEstimate(ids.estimate, EN.warnDivergent, {
          items: [makeItem(warnProductId, { sortOrder: 1, unitPrice: 1000, quantity: 1 })],
        })
      );

      const result = await query.execute({
        estimateId: estimate.id.value,
        variationId: estimate.variations[0].id.value,
        operatorEmployeeId: operatorId,
      });

      expect(result.kind).toBe("EXEMPT");
      if (result.kind !== "EXEMPT") return;
      expect(result.unitPriceWarning).toEqual({ divergentCount: 1, unresolvableCount: 0 });
    });

    it("乖離ゼロなら警告件数は 0（バナーを出さない素材）", async () => {
      await giveCommonSellingPrice(warnProductId, {
        yen: 1000,
        start: ESTIMATE_DATE,
        today: ESTIMATE_DATE,
      });
      const estimate = await estimateRepository.insert(
        buildNewEstimate(ids.estimate, EN.warnNone, {
          items: [makeItem(warnProductId, { sortOrder: 1, unitPrice: 1000, quantity: 1 })],
        })
      );

      const result = await query.execute({
        estimateId: estimate.id.value,
        variationId: estimate.variations[0].id.value,
        operatorEmployeeId: operatorId,
      });

      expect(result.kind).toBe("EXEMPT");
      if (result.kind !== "EXEMPT") return;
      expect(result.unitPriceWarning).toEqual({ divergentCount: 0, unresolvableCount: 0 });
    });

    it("解決不能も件数に載る", async () => {
      // 適用開始を今日（=見積年月日より後）にずらし、2025-04-01 では解決不能にする。
      await giveCommonSellingPrice(warnProductId, { yen: 1000 });
      const estimate = await estimateRepository.insert(
        buildNewEstimate(ids.estimate, EN.warnUnresolvable, {
          items: [makeItem(warnProductId, { sortOrder: 1, unitPrice: 1000, quantity: 1 })],
        })
      );

      const result = await query.execute({
        estimateId: estimate.id.value,
        variationId: estimate.variations[0].id.value,
        operatorEmployeeId: operatorId,
      });

      expect(result.kind).toBe("EXEMPT");
      if (result.kind !== "EXEMPT") return;
      expect(result.unitPriceWarning).toEqual({ divergentCount: 0, unresolvableCount: 1 });
    });
  });

  it("プレビューは副作用を持たない（申請行・免除行を作らない）", async () => {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, EN.sideEffect, {
        items: [
          makeItem(ids.estimate.productId, { sortOrder: 1, unitPrice: 1_000_000, quantity: 1 }),
        ],
      })
    );
    const variationId = estimate.variations[0].id.value;

    await query.execute({
      estimateId: estimate.id.value,
      variationId,
      operatorEmployeeId: operatorId,
    });

    const applications = await prisma.estimateApplication.count({ where: { variationId } });
    const exemptions = await prisma.estimateApprovalExemption.count({ where: { variationId } });
    expect(applications).toBe(0);
    expect(exemptions).toBe(0);
  });
});
