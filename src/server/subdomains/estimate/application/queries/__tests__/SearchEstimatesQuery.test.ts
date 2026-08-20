import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { buildNewEstimate } from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaEstimateQueryService } from "@subdomains/estimate/infrastructure/queries/PrismaEstimateQueryService";
import type {
  EstimateListOptions,
  EstimateSearchCriteria,
} from "@subdomains/estimate/application/queries/dto/EstimateSearchCriteria";
import type { EstimateSummaryDTO } from "@subdomains/estimate/application/queries/dto/EstimateSummaryDTO";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SearchEstimatesQuery } from "../SearchEstimatesQuery";

// 予約済みテスト見積番号（接頭辞 N + 年度 99 + 連番 0200x）。
// GetEstimateDetailQuery（0100x）/ PrismaEstimateRepository（0000x〜00099）と別レンジを使い、
// 共有 dev DB での並行実行衝突を避ける（ADR-0051 / 計画 Q9）。search は空条件＝全件返すため、
// 返り値はこの予約レンジで後フィルタして他データから隔離する。
const EN = {
  repAllActive: "N9902001",
  repMinInactive: "N9902002",
  repAllInactive: "N9902003",
  order1: "N9902004",
  order2: "N9902005",
  order3: "N9902006",
  // フィルタ（#349）用。すべて NEW 区分（接頭辞 N）・共有フィクスチャの単一得意先/作成者。
  filterA: "N9902007",
  filterB: "N9902008",
  filterActive: "N9902009",
  filterInactive: "N9902010",
  filterMixed: "N9902011",
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

  /** 予約レンジに絞った検索結果（共有 dev DB の他データを除外）。criteria 既定は空＝全件。 */
  async function searchReserved(
    criteria: EstimateSearchCriteria = {},
    options?: EstimateListOptions
  ): Promise<EstimateSummaryDTO[]> {
    const all = await query.execute(criteria, options);
    return all.filter((e) => RESERVED.has(e.estimateNumber));
  }

  /** 予約レンジに絞った見積番号集合（フィルタの包含/除外を簡潔に検証するため）。 */
  async function reservedNumbers(criteria: EstimateSearchCriteria = {}): Promise<Set<string>> {
    const result = await searchReserved(criteria);
    return new Set(result.map((e) => e.estimateNumber));
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
      // 納品先は名前のみ（Q1-b・code は載せない）。一覧の「納品先」列の供給元。
      expect(dto.deliveryLocationName).toBe("見積テスト納品先");
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

  describe("代表バリエーション選択（ADR-0051・2 段階フォールバック）", () => {
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

  describe("並び順（ADR-0051・Estimate 自身の列のみ）", () => {
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

      const result = await searchReserved(
        {},
        { orderBy: { field: "deadline", direction: "desc" } }
      );

      // deadline desc → order3(08-15) 先頭。同値 order1/order2 は estimateNumber 昇順で order1→order2。
      expect(result.map((e) => e.estimateNumber)).toEqual([EN.order3, EN.order1, EN.order2]);
    });
  });

  describe("フィルタ（#349・buildWhereClause）", () => {
    it("estimateNumber: 部分一致で絞り込み、無関係な値は 0 件", async () => {
      await createEstimate(EN.filterA);
      await createEstimate(EN.filterB);

      // 完全一致（contains の一形態）→ filterA のみ。
      expect(await reservedNumbers({ estimateNumber: EN.filterA })).toEqual(new Set([EN.filterA]));
      // 共通接頭辞での部分一致 → 両方。
      expect(await reservedNumbers({ estimateNumber: "N990200" })).toEqual(
        new Set([EN.filterA, EN.filterB])
      );
      // 該当なし → 0 件。
      expect(await reservedNumbers({ estimateNumber: "ZZZZ" })).toEqual(new Set());
    });

    it("customerName: 得意先名の部分一致で絞り込み、非マッチは 0 件（ADR-0013 リレーション越し）", async () => {
      await createEstimate(EN.filterA);

      // 共有フィクスチャの得意先名「見積テスト得意先」に部分一致。
      expect(await reservedNumbers({ customerName: "見積テスト" })).toEqual(new Set([EN.filterA]));
      // 非マッチ → 0 件。
      expect(await reservedNumbers({ customerName: "存在しない得意先名" })).toEqual(new Set());
    });

    it("estimateType: 区分の等値で絞り込み（NEW 一致・REPAIR は予約レンジ 0 件）", async () => {
      await createEstimate(EN.filterA); // ビルダーは NEW を生成。

      expect(await reservedNumbers({ estimateType: "NEW" })).toEqual(new Set([EN.filterA]));
      // 予約レンジはすべて NEW なので REPAIR では 0 件（配線立証）。
      expect(await reservedNumbers({ estimateType: "REPAIR" })).toEqual(new Set());
    });

    describe("activeStatus（代表由来・some/none に落とす・ADR-0051）", () => {
      /**
       * 3 パターンを用意: 全 ACTIVE / 全 INACTIVE / mixed（v1 INACTIVE・v2 ACTIVE）。
       * mixed は「代表が ACTIVE ⟺ some ACTIVE」を突く（every との取り違え検知）。
       */
      async function createActiveStatusFixtures(): Promise<void> {
        await createEstimate(EN.filterActive); // v1 ACTIVE → 代表 ACTIVE
        await createEstimate(EN.filterInactive, { deactivate: [1] }); // 全 INACTIVE → 代表 INACTIVE
        await createEstimate(EN.filterMixed, { variationNumbers: [1, 2], deactivate: [1] }); // v1 INACTIVE, v2 ACTIVE → 代表 ACTIVE
      }

      it("ACTIVE: ACTIVE を 1 件以上持つ見積（mixed 含む）、全 INACTIVE は除外", async () => {
        await createActiveStatusFixtures();

        // some ACTIVE。mixed も一部 ACTIVE なので含まれる。
        expect(await reservedNumbers({ activeStatus: "ACTIVE" })).toEqual(
          new Set([EN.filterActive, EN.filterMixed])
        );
      });

      it("INACTIVE: ACTIVE が 1 件も無い見積のみ（mixed は除外）", async () => {
        await createActiveStatusFixtures();

        // none ACTIVE = 全 INACTIVE のみ。mixed は ACTIVE を持つので除外。
        expect(await reservedNumbers({ activeStatus: "INACTIVE" })).toEqual(
          new Set([EN.filterInactive])
        );
      });
    });

    it("複数条件は AND 合成される", async () => {
      await createEstimate(EN.filterActive); // NEW + ACTIVE
      await createEstimate(EN.filterInactive, { deactivate: [1] }); // NEW + INACTIVE

      // NEW かつ ACTIVE → filterActive のみ（filterInactive は区分一致だが状態で除外）。
      expect(await reservedNumbers({ estimateType: "NEW", activeStatus: "ACTIVE" })).toEqual(
        new Set([EN.filterActive])
      );
    });

    it("criteria 未指定（空）は絞り込まず全件返す（従来挙動の維持）", async () => {
      await createEstimate(EN.filterA);
      await createEstimate(EN.filterB);

      expect(await reservedNumbers({})).toEqual(new Set([EN.filterA, EN.filterB]));
    });
  });
});
