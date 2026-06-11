import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { EstimateVariationCopy } from "@subdomains/estimate/domain/values/EstimateVariationCopy";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import {
  buildAfterRepairEstimate,
  buildNewEstimate,
  buildRepairEstimate,
  makeItem,
  makeVariation,
} from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaEstimateRepository } from "../PrismaEstimateRepository";

// 予約済みテスト見積番号（接頭辞 N/R/A + 年度 99 + 連番）。実データと衝突しない範囲を使用。
const EN = {
  new: "N9900001",
  repair: "R9900001",
  afterRepair: "A9900001",
  updateItems: "N9900002",
  updateSwap: "N9900003",
  findByNumber: "N9900004",
  del: "N9900005",
  conflict: "N9900006",
  fkViolation: "N9900007",
  optimistic: "N9900008",
  staleToken: "N9900009",
  dupSource: "N9900010",
  dup: "N9900011",
  missing: "N9900099",
} as const;
const ALL_NUMBERS = Object.values(EN);

// 形式は正しい（UUIDv7）が DB に存在しない得意先 ID。FK 違反を意図的に起こすために使う。
const NON_EXISTENT_CUSTOMER_ID = "00000000-0000-7000-8000-000000000777";

async function cleanupEstimates(): Promise<void> {
  // 複製系譜（estimate_variation_copies）を先に削除する。source 側参照は cascade されないため、
  // estimate を消す前に系譜行を除去しておく必要がある（C6 / ADR-0040・0041）。
  const estimates = await prisma.estimate.findMany({
    where: { estimateNumber: { in: [...ALL_NUMBERS] } },
    select: { variations: { select: { id: true } } },
  });
  const variationIds = estimates.flatMap((e) => e.variations.map((v) => v.id));
  if (variationIds.length > 0) {
    await prisma.estimateVariationCopy.deleteMany({
      where: {
        OR: [
          { copiedVariationId: { in: variationIds } },
          { sourceVariationId: { in: variationIds } },
        ],
      },
    });
  }
  await prisma.estimate.deleteMany({ where: { estimateNumber: { in: [...ALL_NUMBERS] } } });
}

describe("PrismaEstimateRepository", () => {
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateRepository();
    await cleanupEstimates();
  });

  afterAll(async () => {
    await cleanupEstimates();
  });

  describe("insert → findById ラウンドトリップ", () => {
    it("NEW: バリエーション・明細・改訂明細詳細を含めて等価に再構築できる", async () => {
      const saved = await repository.insert(buildNewEstimate(ids, EN.new));

      const found = await repository.findById(saved.id);

      expect(found).not.toBeNull();
      if (!found) return;
      expect(found.id.value).toBe(saved.id.value);
      expect(found.estimateNumber.value).toBe(EN.new);
      expect(found.estimateType.value).toBe("NEW");
      expect(found.customerId.value).toBe(ids.customerId);
      expect(found.deliveryLocationId.value).toBe(ids.deliveryLocationId);

      expect(found.variations).toHaveLength(1);
      const fv = found.variations[0];
      const sv = saved.variations[0];
      expect(fv.id.value).toBe(sv.id.value);
      expect(fv.variationNumber).toBe(1);
      // 集計 5 種が保存値どおりに再構築される
      expect(fv.subtotal.minorUnits).toBe(sv.subtotal.minorUnits);
      expect(fv.finalTotal.minorUnits).toBe(sv.finalTotal.minorUnits);
      expect(fv.taxAmount.minorUnits).toBe(sv.taxAmount.minorUnits);

      // 明細（sortOrder 昇順）と id の保持
      expect(fv.items).toHaveLength(2);
      expect(fv.items[0].id.value).toBe(sv.items[0].id.value);
      expect(fv.items[0].sortOrder).toBe(1);
      expect(fv.items[0].baseAmount.minorUnits).toBe(sv.items[0].baseAmount.minorUnits);

      // 改訂明細詳細（2 件目）
      const revisedItem = fv.items[1];
      expect(revisedItem.revisedDetail).not.toBeNull();
      expect(revisedItem.revisedDetail?.deliveryPrice.majorUnits).toBe(800);
    });

    it("REPAIR: repairDetail を含めて等価に再構築でき、afterRepairDetail は null", async () => {
      const saved = await repository.insert(buildRepairEstimate(ids, EN.repair));
      const found = await repository.findById(saved.id);

      expect(found).not.toBeNull();
      if (!found) return;
      expect(found.estimateType.value).toBe("REPAIR");
      expect(found.afterRepairDetail).toBeNull();
      expect(found.repairDetail).not.toBeNull();
      expect(found.repairDetail?.targetProductId.value).toBe(ids.productId);
      expect(found.repairDetail?.faultDescription.value).toBe("電源が入らない");
      expect(found.repairDetail?.id.value).toBe(saved.repairDetail?.id.value);
    });

    it("AFTER_REPAIR: afterRepairDetail（警告フラグ含む）を等価に再構築でき、repairDetail は null", async () => {
      const saved = await repository.insert(buildAfterRepairEstimate(ids, EN.afterRepair));
      const found = await repository.findById(saved.id);

      expect(found).not.toBeNull();
      if (!found) return;
      expect(found.estimateType.value).toBe("AFTER_REPAIR");
      expect(found.repairDetail).toBeNull();
      expect(found.afterRepairDetail).not.toBeNull();
      expect(found.afterRepairDetail?.emergencyReason.value).toBe("顧客ライン停止のため緊急対応");
      expect(found.afterRepairDetail?.afterServiceWarningAcknowledged).toBe(false);
      expect(found.afterRepairDetail?.id.value).toBe(saved.afterRepairDetail?.id.value);
    });
  });

  describe("update（差分 upsert）", () => {
    it("明細の追加・削除・数量変更が反映され、残存明細の id は保持される", async () => {
      const saved = await repository.insert(buildNewEstimate(ids, EN.updateItems));
      const variationId = saved.variations[0].id;
      const keepItemId = saved.variations[0].items[0].id; // sortOrder 1（残す・数量変更）
      const removeItemId = saved.variations[0].items[1].id; // sortOrder 2（削除）

      // 数量変更 → 明細削除 → 明細追加
      saved.changeItemQuantity(variationId, keepItemId, new Quantity(5));
      saved.removeItem(variationId, removeItemId);
      saved.addItem(
        variationId,
        makeItem(ids.productId, { sortOrder: 3, itemName: "追加商品", unitPrice: 300, quantity: 1 })
      );

      await repository.update(saved, 1);
      const found = await repository.findById(saved.id);

      expect(found).not.toBeNull();
      if (!found) return;
      const items = found.variations[0].items;
      expect(items).toHaveLength(2);

      const keptItem = items.find((i) => i.id.value === keepItemId.value);
      expect(keptItem).toBeDefined();
      expect(keptItem?.quantity.value).toBe(5); // 数量変更が反映

      // 削除した明細は存在しない
      expect(items.some((i) => i.id.value === removeItemId.value)).toBe(false);
      // 追加した明細が存在する
      expect(items.some((i) => i.itemName.value === "追加商品")).toBe(true);
    });

    it("バリエーションの追加・削除が反映され、残存バリエーションの id は保持される", async () => {
      const saved = await repository.insert(
        buildNewEstimate(ids, EN.updateSwap, { variationNumbers: [1, 2] })
      );
      const keepVariationId = saved.variations.find((v) => v.variationNumber === 1)?.id;
      const removeVariationId = saved.variations.find((v) => v.variationNumber === 2)?.id;
      expect(keepVariationId).toBeDefined();
      expect(removeVariationId).toBeDefined();
      if (!keepVariationId || !removeVariationId) return;

      // #2 を削除し、新しい #3 を追加
      saved.removeVariation(removeVariationId);
      saved.addVariation(makeVariation(ids.productId, 3));

      await repository.update(saved, 1);
      const found = await repository.findById(saved.id);

      expect(found).not.toBeNull();
      if (!found) return;
      expect(found.variations).toHaveLength(2);
      // 残した #1 は id 保持
      expect(found.variations.some((v) => v.id.value === keepVariationId.value)).toBe(true);
      // 削除した #2 は存在しない
      expect(found.variations.some((v) => v.id.value === removeVariationId.value)).toBe(false);
      // 追加した #3 が存在する
      expect(found.variations.some((v) => v.variationNumber === 3)).toBe(true);
    });
  });

  describe("findByEstimateNumber", () => {
    it("一致する見積を取得できる", async () => {
      const saved = await repository.insert(buildNewEstimate(ids, EN.findByNumber));
      const found = await repository.findByEstimateNumber(EstimateNumber.parse(EN.findByNumber));
      expect(found?.id.value).toBe(saved.id.value);
    });

    it("一致しない場合は null を返す", async () => {
      const found = await repository.findByEstimateNumber(EstimateNumber.parse(EN.missing));
      expect(found).toBeNull();
    });
  });

  describe("insert（採番衝突）", () => {
    it("既存と同一の見積番号を別集約で新規保存すると ConflictError を投げる", async () => {
      // 1 件目は成功
      await repository.insert(buildNewEstimate(ids, EN.conflict));

      // 別 id・同一見積番号の集約を新規保存 → estimate_number @unique 違反
      await expect(repository.insert(buildNewEstimate(ids, EN.conflict))).rejects.toThrow(
        ConflictError
      );
    });

    it("採番衝突以外のエラー（FK 違反）は ConflictError に変換せずそのまま投げる", async () => {
      // 存在しない customerId を持つ集約を保存 → estimate_number ではなく FK 違反が起きる。
      // isEstimateNumberConflict が false を返し、元のエラーがそのまま bubble することを検証する
      // （= 衝突翻訳が estimate_number の P2002 以外を握りつぶさない）。
      const invalidIds = { ...ids, customerId: NON_EXISTENT_CUSTOMER_ID };

      let caught: unknown;
      try {
        await repository.insert(buildNewEstimate(invalidIds, EN.fkViolation));
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeDefined();
      expect(caught).not.toBeInstanceOf(ConflictError);
    });
  });

  describe("楽観ロック（ADR-0039）", () => {
    it("insert した集約（version 1）を expectedVersion=1 で更新でき、更新後は 2 で更新できる", async () => {
      const saved = await repository.insert(buildNewEstimate(ids, EN.optimistic));

      // insert 直後の version は 1。一致するトークンでの更新は成功し、version は 2 に進む
      const first = await repository.update(saved, 1);
      expect(first.id.value).toBe(saved.id.value);

      // 進んだ version 2 を提示すれば続けて更新できる
      await expect(repository.update(first, 2)).resolves.toBeDefined();
    });

    it("古い expectedVersion での更新は ConflictError になり、先行の変更は失われない", async () => {
      const saved = await repository.insert(buildNewEstimate(ids, EN.staleToken));

      // 2人のユーザーが同じ version 1 の画面を開いた状況を再現
      const loadedByB = await repository.findById(saved.id);
      const loadedByA = await repository.findById(saved.id);
      expect(loadedByB).not.toBeNull();
      expect(loadedByA).not.toBeNull();
      if (!loadedByB || !loadedByA) return;

      // B が先に保存（version 1 → 2）
      loadedByB.changeDeadline(new Date("2025-12-31T00:00:00.000Z"));
      await repository.update(loadedByB, 1);

      // A が古いトークン 1 のまま保存 → 競合として弾かれる
      loadedByA.changeDeadline(new Date("2025-11-30T00:00:00.000Z"));
      await expect(repository.update(loadedByA, 1)).rejects.toThrow(ConflictError);

      // B の変更が残っている（lost update が起きていない）
      const found = await repository.findById(saved.id);
      expect(found?.deadline.toISOString()).toBe("2025-12-31T00:00:00.000Z");
    });
  });

  describe("delete", () => {
    it("見積を削除すると子（variation/item/revisedDetail）がカスケード削除される", async () => {
      const saved = await repository.insert(buildNewEstimate(ids, EN.del));
      const estimateId = saved.id.value;

      await repository.delete(saved.id);

      expect(await repository.findById(saved.id)).toBeNull();
      expect(await prisma.estimateVariation.count({ where: { estimateId } })).toBe(0);
      expect(await prisma.estimateItem.count({ where: { variation: { estimateId } } })).toBe(0);
      expect(
        await prisma.revisedEstimateItemDetail.count({
          where: { estimateItem: { variation: { estimateId } } },
        })
      ).toBe(0);
    });

    it("存在しない ID の削除は no-op（例外を投げない）", async () => {
      await expect(repository.delete(EstimateId.generate())).resolves.toBeUndefined();
    });
  });

  describe("insertWithCopies - 複製系譜の永続化（C6）", () => {
    it("新見積と系譜を同一トランザクションで保存し、系譜行を確認できる", async () => {
      const source = await repository.insert(
        buildNewEstimate(ids, EN.dupSource, { variationNumbers: [1, 2] })
      );
      const target = buildNewEstimate(ids, EN.dup, { variationNumbers: [1, 2] });
      const copies = [
        EstimateVariationCopy.create(target.variations[0].id, source.variations[0].id),
        EstimateVariationCopy.create(target.variations[1].id, source.variations[1].id),
      ];

      const saved = await repository.insertWithCopies(target, copies);

      // 集約が保存される
      const found = await repository.findById(saved.id);
      expect(found).not.toBeNull();
      expect(found?.variations).toHaveLength(2);

      // 系譜行（自然キー copiedVariationId）が複製元を指して保存される
      const rows = await prisma.estimateVariationCopy.findMany({
        where: { copiedVariationId: { in: target.variations.map((v) => v.id.value) } },
      });
      expect(rows).toHaveLength(2);
      const sourceByCopied = new Map(rows.map((r) => [r.copiedVariationId, r.sourceVariationId]));
      expect(sourceByCopied.get(target.variations[0].id.value)).toBe(source.variations[0].id.value);
      expect(sourceByCopied.get(target.variations[1].id.value)).toBe(source.variations[1].id.value);
    });

    it("copies が空でも新見積は保存される", async () => {
      const saved = await repository.insertWithCopies(buildNewEstimate(ids, EN.dup), []);

      expect(await repository.findById(saved.id)).not.toBeNull();
      expect(
        await prisma.estimateVariationCopy.count({
          where: { copiedVariation: { estimate: { estimateNumber: EN.dup } } },
        })
      ).toBe(0);
    });
  });
});
