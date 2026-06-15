import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { buildNewEstimate } from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaEstimateQueryService } from "@subdomains/estimate/infrastructure/queries/PrismaEstimateQueryService";
import type { EstimateListOptions } from "@subdomains/estimate/application/queries/dto/EstimateSearchCriteria";
import type { EstimateSummaryDTO } from "@subdomains/estimate/application/queries/dto/EstimateSummaryDTO";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SearchEstimatesQuery } from "../SearchEstimatesQuery";

// 予約済みテスト見積番号（接頭辞 N + 年度 99 + 連番 0200x）。
// GetEstimateDetailQuery（0100x）/ PrismaEstimateRepository（0000x〜00099）と別レンジを使い、
// 共有 dev DB での並行実行衝突を避ける（ADR-0050 / 計画 Q9）。search は空条件＝全件返すため、
// 返り値はこの予約レンジで後フィルタして他データから隔離する。
const EN = {
  repAllActive: "N9902001",
  repMinInactive: "N9902002",
  repAllInactive: "N9902003",
  order1: "N9902004",
  order2: "N9902005",
  order3: "N9902006",
} as const;
const ALL_NUMBERS = Object.values(EN);
const RESERVED = new Set<string>(ALL_NUMBERS);

async function cleanupEstimates(): Promise<void> {
  await prisma.estimate.deleteMany({ where: { estimateNumber: { in: [...ALL_NUMBERS] } } });
}

describe("SearchEstimatesQuery", () => {
  let query: SearchEstimatesQuery;
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateRepository();
    query = new SearchEstimatesQuery(new PrismaEstimateQueryService());
    await cleanupEstimates();
  });

  afterAll(async () => {
    await cleanupEstimates();
  });

  /**
   * 見積を 1 件作成して永続化する。ビルダーは触らず（finalTotal は全 V 一律 2750 のため）、
   * insert 後に prisma 直更新で finalTotal・deadline を散らし、代表選択・並び順を識別可能にする。
   */
  async function createEstimate(
    estimateNumber: string,
    opts: {
      variationNumbers?: number[];
      /** 無効化するバリエーション番号（ドメイン経路 deactivateVariation）。 */
      deactivate?: number[];
      /** バリエーション番号→finalTotal（円）。代表を金額で識別するため。 */
      finalTotals?: Record<number, number>;
      deadline?: Date;
    } = {}
  ): Promise<string> {
    const estimate = buildNewEstimate(ids, estimateNumber, {
      variationNumbers: opts.variationNumbers ?? [1],
    });
    for (const n of opts.deactivate ?? []) {
      const v = estimate.variations.find((x) => x.variationNumber === n)!;
      estimate.deactivateVariation(v.id);
    }
    await repository.insert(estimate);

    // ドメイン ID は値オブジェクト（EstimateId）。prisma へは生文字列（.value）を渡す。
    const estimateId = estimate.id.value;
    for (const [n, total] of Object.entries(opts.finalTotals ?? {})) {
      await prisma.estimateVariation.update({
        where: { estimateId_variationNumber: { estimateId, variationNumber: Number(n) } },
        data: { finalTotal: total },
      });
    }
    if (opts.deadline) {
      await prisma.estimate.update({
        where: { id: estimateId },
        data: { deadline: opts.deadline },
      });
    }
    return estimateId;
  }

  /** 予約レンジに絞った検索結果（共有 dev DB の他データを除外）。 */
  async function searchReserved(options?: EstimateListOptions): Promise<EstimateSummaryDTO[]> {
    const all = await query.execute({}, options);
    return all.filter((e) => RESERVED.has(e.estimateNumber));
  }

  describe("DTO の組み立て（ADR-0013 名前解決・displayStatus 予約）", () => {
    it("コード+名称を解決し、finalTotal/activeStatus は代表由来・displayStatus は常に null", async () => {
      await createEstimate(EN.repAllActive);

      const result = await searchReserved();

      expect(result).toHaveLength(1);
      const dto = result[0];
      expect(dto.estimateNumber).toBe(EN.repAllActive);
      expect(dto.estimateType).toBe("NEW");
      // ADR-0013: リレーション先のコード・名称を解決する。
      expect(dto.customerCode).toBe("CFX99901");
      expect(dto.customerName).toBe("見積テスト得意先");
      expect(dto.creatorCode).toBe("EMP999091");
      expect(dto.creatorName).toBe("見積テスト作成者");
      // 永続集計（ADR-0033）。デフォルト 1 バリエーション = 2750。
      expect(dto.finalTotal).toBe(2750);
      expect(dto.activeStatus).toBe("ACTIVE");
      // 表示ステータスは本 issue では常に null（場所だけ予約）。
      expect(dto.displayStatus).toBeNull();
      // 日付は Date 型で載る。
      expect(dto.estimateDate).toBeInstanceOf(Date);
      expect(dto.deadline).toBeInstanceOf(Date);
    });
  });

  describe("代表バリエーション選択（ADR-0050・2 段階フォールバック）", () => {
    it("全 ACTIVE → 最小 variationNumber の値を代表にする", async () => {
      await createEstimate(EN.repAllActive, {
        variationNumbers: [1, 2, 3],
        finalTotals: { 1: 1000, 2: 2000, 3: 3000 },
      });

      const [dto] = await searchReserved();
      // 代表 = ACTIVE 最小 = v1 → finalTotal 1000。
      expect(dto.finalTotal).toBe(1000);
      expect(dto.activeStatus).toBe("ACTIVE");
    });

    it("最小が INACTIVE・上位が ACTIVE → ACTIVE のうち最小を代表にする", async () => {
      await createEstimate(EN.repMinInactive, {
        variationNumbers: [1, 2, 3],
        deactivate: [1],
        finalTotals: { 1: 1000, 2: 2000, 3: 3000 },
      });

      const [dto] = await searchReserved();
      // v1 は INACTIVE。代表 = ACTIVE 最小 = v2 → finalTotal 2000。
      expect(dto.finalTotal).toBe(2000);
      expect(dto.activeStatus).toBe("ACTIVE");
    });

    it("全 INACTIVE → 全体の最小 variationNumber を代表にし、activeStatus は INACTIVE を返す", async () => {
      await createEstimate(EN.repAllInactive, {
        variationNumbers: [1, 2, 3],
        deactivate: [1, 2, 3],
        finalTotals: { 1: 1000, 2: 2000, 3: 3000 },
      });

      const [dto] = await searchReserved();
      // ACTIVE 不在 → フォールバックで全体最小 = v1 → finalTotal 1000、状態は正直に INACTIVE。
      expect(dto.finalTotal).toBe(1000);
      expect(dto.activeStatus).toBe("INACTIVE");
    });
  });

  describe("並び順（ADR-0050・Estimate 自身の列のみ）", () => {
    it("既定は deadline 昇順（多段既定 [deadline, createdAt, estimateNumber]）", async () => {
      await createEstimate(EN.order1, { deadline: new Date("2025-06-10T00:00:00.000Z") });
      await createEstimate(EN.order2, { deadline: new Date("2025-05-01T00:00:00.000Z") });
      await createEstimate(EN.order3, { deadline: new Date("2025-07-20T00:00:00.000Z") });

      const result = await searchReserved();

      expect(result.map((e) => e.estimateNumber)).toEqual([EN.order2, EN.order1, EN.order3]);
    });

    it("指定キー降順＋同値は第 2 キー estimateNumber 昇順で安定化する", async () => {
      // order1 と order2 を同一 deadline にして primary キーで同値を作る。
      await createEstimate(EN.order1, { deadline: new Date("2025-08-01T00:00:00.000Z") });
      await createEstimate(EN.order2, { deadline: new Date("2025-08-01T00:00:00.000Z") });
      await createEstimate(EN.order3, { deadline: new Date("2025-08-15T00:00:00.000Z") });

      const result = await searchReserved({ orderBy: { field: "deadline", direction: "desc" } });

      // deadline desc → order3(08-15) 先頭。同値 order1/order2 は estimateNumber 昇順で order1→order2。
      expect(result.map((e) => e.estimateNumber)).toEqual([EN.order3, EN.order1, EN.order2]);
    });
  });
});
