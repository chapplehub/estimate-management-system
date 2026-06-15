import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import {
  buildAfterRepairEstimate,
  buildEstimateWithSetGroup,
  buildNewEstimate,
  buildRepairEstimate,
} from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaEstimateQueryService } from "@subdomains/estimate/infrastructure/queries/PrismaEstimateQueryService";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GetEstimateDetailQuery } from "../GetEstimateDetailQuery";

// 予約済みテスト見積番号（接頭辞 N/R/A + 年度 99 + 連番）。
// PrismaEstimateRepository.test.ts（連番 0000x〜00099）と別レンジ（連番 0100x）を使い、
// 共有 dev DB での並行実行衝突を避ける（計画 Q9）。
const EN = {
  basic: "N9901001",
  setGroup: "N9901002",
  multiVariation: "N9901003",
  repair: "R9901001",
  afterRepair: "A9901001",
  missing: "N9901099",
} as const;
const ALL_NUMBERS = Object.values(EN);

async function cleanupEstimates(): Promise<void> {
  // 本テストは改訂・複製系譜（source 側 FK Restrict）を生成しないため、
  // estimate.deleteMany のカスケードのみで子（variation/item/setGroup/component）まで消える。
  await prisma.estimate.deleteMany({ where: { estimateNumber: { in: [...ALL_NUMBERS] } } });
}

describe("GetEstimateDetailQuery", () => {
  let query: GetEstimateDetailQuery;
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateRepository();
    query = new GetEstimateDetailQuery(new PrismaEstimateQueryService());
    await cleanupEstimates();
  });

  afterAll(async () => {
    await cleanupEstimates();
  });

  describe("ヘッダ（③ 基本情報・ADR-0013）", () => {
    it("見積番号で見積詳細を取得し、区分・version・基本情報の名前/コードを返す", async () => {
      await repository.insert(buildNewEstimate(ids, EN.basic));

      const dto = await query.execute({ estimateNumber: EN.basic });

      expect(dto).not.toBeNull();
      if (!dto) return;
      expect(dto.estimateNumber).toBe(EN.basic);
      expect(dto.estimateType).toBe("NEW");
      // 楽観ロックトークンを前倒しで DTO に含める（ADR-0039・Q10）。insert 直後は 1
      expect(dto.version).toBe(1);
      // ADR-0013: リレーション先の名前・コードを含める
      expect(dto.customerName).toBe("見積テスト得意先");
      expect(dto.customerCode).toBe("CFX99901");
      expect(dto.deliveryLocationName).toBe("見積テスト納品先");
      expect(dto.deliveryLocationCode).toBe("DFX99901");
      expect(dto.creatorName).toBe("見積テスト作成者");
      expect(dto.creatorCode).toBe("EMP999091");
      expect(typeof dto.departmentName).toBe("string");
    });

    it("存在しない見積番号では null を返す", async () => {
      const dto = await query.execute({ estimateNumber: EN.missing });
      expect(dto).toBeNull();
    });
  });

  describe("バリエーション・通常明細", () => {
    it("永続集計（ADR-0033）と通常明細（read-through code/区分・改訂価格）を返す", async () => {
      await repository.insert(buildNewEstimate(ids, EN.basic));

      const dto = await query.execute({ estimateNumber: EN.basic });
      expect(dto).not.toBeNull();
      if (!dto) return;

      expect(dto.variations).toHaveLength(1);
      const v = dto.variations[0];
      expect(v.variationNumber).toBe(1);
      expect(v.status).toBe("ACTIVE");
      expect(v.submissionType).toBe("CUSTOMER");

      // 永続化された集計をそのまま読む（再計算しない・ADR-0033）。
      // 商品A 1000×2=2000 ＋ 商品B 500×1=500 → 小計 2500、税10%切捨 250、合計 2750。
      expect(v.subtotal).toBe(2500);
      expect(v.taxAmount).toBe(250);
      expect(v.finalTotal).toBe(2750);

      // 明細は sortOrder 昇順、2 件とも通常明細（セット群なし）。
      expect(v.lines).toHaveLength(2);

      const lineA = v.lines[0];
      expect(lineA.kind).toBe("line");
      if (lineA.kind !== "line") return;
      expect(lineA.itemName).toBe("商品A-0");
      expect(lineA.sortOrder).toBe(1);
      expect(lineA.quantity).toBe(2);
      expect(lineA.unitPrice).toBe(1000);
      expect(lineA.finalAmount).toBe(2000);
      // read-through（ADR-0048）: 現在マスタ join で code/区分を解決する。
      expect(lineA.productCode).toBe("PRDFX99901");
      expect(lineA.productCategory).toBe("INDIVIDUAL");
      expect(lineA.revisedDeliveryPrice).toBeNull();

      const lineB = v.lines[1];
      expect(lineB.kind).toBe("line");
      if (lineB.kind !== "line") return;
      expect(lineB.itemName).toBe("商品B-0");
      expect(lineB.finalAmount).toBe(500);
      // 商品B は改訂明細詳細（deliveryPrice 800）を持つ（§8.4）。
      expect(lineB.revisedDeliveryPrice).toBe(800);
    });
  });

  describe("セット群（ADR-0047 / Shape ③-a）", () => {
    it("入れ子 SetGroupDTO（導出 amount=Σ・sortOrder=min）と非交錯のマージ順を返す", async () => {
      await repository.insert(buildEstimateWithSetGroup(ids, EN.setGroup, { memberCount: 2 }));

      const dto = await query.execute({ estimateNumber: EN.setGroup });
      expect(dto).not.toBeNull();
      if (!dto) return;

      const lines = dto.variations[0].lines;
      // top-level は [セット群(導出位置1), 通常明細(位置3)] の 2 要素（構成明細は群に内包）。
      expect(lines).toHaveLength(2);

      const group = lines[0];
      expect(group.kind).toBe("setGroup");
      if (group.kind !== "setGroup") return;
      // 導出（ADR-0047）: 位置 = min(構成 sortOrder 1,2) = 1、金額 = Σ finalAmount(1000+2000) = 3000。
      expect(group.sortOrder).toBe(1);
      expect(group.amount).toBe(3000);
      // セット商品の read-through（ADR-0048）。
      expect(group.productCode).toBe("PRDFX99902");
      expect(group.productCategory).toBe("SET");
      expect(group.itemName).toBe("テストセット商品");
      // 構成明細は sortOrder 昇順で内包される。
      expect(group.components).toHaveLength(2);
      expect(group.components[0].itemName).toBe("構成1");
      expect(group.components[0].finalAmount).toBe(1000);
      expect(group.components[1].itemName).toBe("構成2");
      expect(group.components[1].finalAmount).toBe(2000);

      const normal = lines[1];
      expect(normal.kind).toBe("line");
      if (normal.kind !== "line") return;
      expect(normal.itemName).toBe("通常明細");
      expect(normal.sortOrder).toBe(3);
    });
  });

  describe("複数バリエーション・状態（Q7）", () => {
    it("variationNumber 昇順で返し、INACTIVE 状態を忠実に反映する", async () => {
      const estimate = buildNewEstimate(ids, EN.multiVariation, { variationNumbers: [1, 2] });
      const v2 = estimate.variations.find((v) => v.variationNumber === 2)!;
      estimate.deactivateVariation(v2.id);
      await repository.insert(estimate);

      const dto = await query.execute({ estimateNumber: EN.multiVariation });
      expect(dto).not.toBeNull();
      if (!dto) return;

      // 表示順は variationNumber 昇順（include の orderBy）。
      expect(dto.variations.map((v) => v.variationNumber)).toEqual([1, 2]);
      // 状態は保存値どおり（presentation が全無効警告・グレーアウトを導出する素材・Q7）。
      expect(dto.variations[0].status).toBe("ACTIVE");
      expect(dto.variations[1].status).toBe("INACTIVE");
    });
  });

  describe("修理情報（③・Q10）", () => {
    it("REPAIR: repairDetail（対象商品 read-through・故障内容）を載せ afterRepair は null", async () => {
      await repository.insert(buildRepairEstimate(ids, EN.repair));

      const dto = await query.execute({ estimateNumber: EN.repair });
      expect(dto).not.toBeNull();
      if (!dto) return;

      expect(dto.estimateType).toBe("REPAIR");
      expect(dto.afterRepairDetail).toBeNull();
      expect(dto.repairDetail).not.toBeNull();
      expect(dto.repairDetail?.faultDescription).toBe("電源が入らない");
      // 修理対象機器は read-through join で code/名称を解決する。
      expect(dto.repairDetail?.targetProductCode).toBe("PRDFX99901");
      expect(dto.repairDetail?.targetProductName).toBe("見積永続化テスト商品");
    });

    it("AFTER_REPAIR: afterRepairDetail（緊急理由・警告フラグ）を載せ repair は null", async () => {
      await repository.insert(buildAfterRepairEstimate(ids, EN.afterRepair));

      const dto = await query.execute({ estimateNumber: EN.afterRepair });
      expect(dto).not.toBeNull();
      if (!dto) return;

      expect(dto.estimateType).toBe("AFTER_REPAIR");
      expect(dto.repairDetail).toBeNull();
      expect(dto.afterRepairDetail).not.toBeNull();
      expect(dto.afterRepairDetail?.emergencyReason).toBe("顧客ライン停止のため緊急対応");
      expect(dto.afterRepairDetail?.afterServiceWarningAcknowledged).toBe(false);
    });
  });
});
