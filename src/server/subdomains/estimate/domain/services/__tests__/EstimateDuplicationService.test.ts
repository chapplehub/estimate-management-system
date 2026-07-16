import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";

import { Estimate, EstimateFactory } from "../../entities";
import { DiscountRate } from "../../values/DiscountRate";
import { EstimateNumber } from "../../values/EstimateNumber";
import { EstimateVariationId } from "../../values/EstimateVariationId";
import { FaultDescription } from "../../values/FaultDescription";
import { ItemName } from "../../values/ItemName";
import { Memo } from "../../values/Memo";
import { Money } from "@server/shared/domain/values/Money";
import { Quantity } from "../../values/Quantity";
import { SubmissionType } from "../../values/SubmissionType";
import { TaxRate } from "../../values/TaxRate";
import { TaxRoundingType } from "../../values/TaxRoundingType";
import { Unit } from "../../values/Unit";
import {
  EstimateDuplicationService,
  duplicatedUnitPriceKey,
  type DuplicatedUnitPriceMap,
} from "../EstimateDuplicationService";

const UUID = "00000000-0000-7000-8000-000000000001";
/** セット商品（群自身の productId。価格を持たないため単価解決の対象外）。 */
const SET_PRODUCT_UUID = "00000000-0000-7000-8000-000000000002";
/** 構成明細の商品（価格付き末端行なので単価解決の対象）。 */
const COMPONENT_PRODUCT_UUID = "00000000-0000-7000-8000-000000000003";

/**
 * 複製元の全明細（各バリエーションの提出区分×商品ID）を一律 `yen` 円で解決した単価マップを作る。
 * アプリ層が価格決定で構築するマップをドメインテストで代替する。
 */
function pricesFor(source: Estimate, yen = 800): DuplicatedUnitPriceMap {
  const map = new Map<string, Money>();
  for (const variation of source.variations) {
    for (const item of variation.items) {
      map.set(
        duplicatedUnitPriceKey(variation.submissionType, item.productId.value),
        Money.fromMajorUnits(yen)
      );
    }
  }
  return map;
}

/** 複製元（NEW・2 バリエーション、率・固定値引・メモ付き）を生成する。 */
function buildSourceNew(): Estimate {
  return EstimateFactory.create({
    estimateNumber: EstimateNumber.parse("N2500001"),
    estimateDate: new Date("2025-04-01T00:00:00.000Z"),
    deadline: new Date("2025-04-30T00:00:00.000Z"),
    customerId: new CustomerId(UUID),
    deliveryLocationId: new DeliveryLocationId(UUID),
    taxRate: new TaxRate(0.1),
    taxRoundingType: TaxRoundingType.ROUND_DOWN,
    createdBy: new EmployeeId(UUID),
    departmentId: new DepartmentId(UUID),
    variations: [
      {
        setGroups: [],
        variationNumber: 1,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        overallDiscount: Money.fromMajorUnits(300),
        customerMemo: Memo.create("バリエーション1メモ"),
        items: [
          {
            productId: new ProductId(UUID),
            sortOrder: 1,
            itemName: new ItemName("商品A"),
            quantity: new Quantity(2),
            unit: new Unit("個"),
            unitPrice: Money.fromMajorUnits(1000),
            discountRate: new DiscountRate(0.95),
            itemDiscount: Money.fromMajorUnits(100),
            customerMemo: Memo.create("明細メモ"),
          },
        ],
      },
      {
        setGroups: [],
        variationNumber: 2,
        submissionType: SubmissionType.CUSTOMER,
        items: [
          {
            productId: new ProductId(UUID),
            sortOrder: 1,
            itemName: new ItemName("商品B"),
            quantity: new Quantity(1),
            unit: new Unit("式"),
            unitPrice: Money.fromMajorUnits(500),
          },
        ],
      },
    ],
  });
}

/** 複製元（セット群 1 つ＝構成明細 2 件＋通常明細 1 件）を生成する（#602）。 */
function buildSourceWithSetGroup(): Estimate {
  return EstimateFactory.create({
    estimateNumber: EstimateNumber.parse("N2500002"),
    estimateDate: new Date("2025-04-01T00:00:00.000Z"),
    deadline: new Date("2025-04-30T00:00:00.000Z"),
    customerId: new CustomerId(UUID),
    deliveryLocationId: new DeliveryLocationId(UUID),
    taxRate: new TaxRate(0.1),
    taxRoundingType: TaxRoundingType.ROUND_DOWN,
    createdBy: new EmployeeId(UUID),
    departmentId: new DepartmentId(UUID),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        items: [
          {
            productId: new ProductId(UUID),
            sortOrder: 3,
            itemName: new ItemName("通常明細"),
            quantity: new Quantity(1),
            unit: new Unit("個"),
            unitPrice: Money.fromMajorUnits(500),
          },
        ],
        setGroups: [
          {
            productId: new ProductId(SET_PRODUCT_UUID),
            itemName: new ItemName("セット商品X"),
            unit: new Unit("式"),
            customerMemo: Memo.create("群の顧客メモ"),
            internalMemo: Memo.create("群の社内メモ"),
            components: [
              {
                productId: new ProductId(COMPONENT_PRODUCT_UUID),
                sortOrder: 1,
                itemName: new ItemName("構成1"),
                quantity: new Quantity(2),
                unit: new Unit("個"),
                unitPrice: Money.fromMajorUnits(1000),
                discountRate: new DiscountRate(0.9),
                itemDiscount: Money.fromMajorUnits(100),
                customerMemo: Memo.create("構成1メモ"),
              },
              {
                productId: new ProductId(COMPONENT_PRODUCT_UUID),
                sortOrder: 2,
                itemName: new ItemName("構成2"),
                quantity: new Quantity(1),
                unit: new Unit("個"),
                unitPrice: Money.fromMajorUnits(2000),
              },
            ],
          },
        ],
      },
    ],
  });
}

function context(source: Estimate, estimateNumber = "N2500099") {
  return {
    estimateNumber: EstimateNumber.parse(estimateNumber),
    estimateDate: new Date("2025-06-01T00:00:00.000Z"),
    deadline: new Date("2025-06-30T00:00:00.000Z"),
    taxRate: new TaxRate(0.1),
    createdBy: new EmployeeId(UUID),
    departmentId: new DepartmentId(UUID),
    resolvedUnitPrices: pricesFor(source),
  };
}

describe("EstimateDuplicationService", () => {
  describe("duplicate() - 正常系", () => {
    it("選択順を保持し variationNumber を 1 から連番に振り直す", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      // 逆順に選択
      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [ids[1], ids[0]],
        ...context(source),
      });

      expect(estimate.variations).toHaveLength(2);
      expect(estimate.variations[0].variationNumber).toBe(1);
      expect(estimate.variations[1].variationNumber).toBe(2);
      // 1 番目（複製先）は複製元 ids[1]（商品B）由来
      expect(estimate.variations[0].items[0].itemName.value).toBe("商品B");
    });

    it("単価は解決済み単価マップの値になり、固定値引（明細・全体）はクリアする", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [ids[0]],
        // ids[0]（納品先宛）の商品を 800 円で解決したマップを渡す
        ...context(source),
        resolvedUnitPrices: pricesFor(source, 800),
      });

      const variation = estimate.variations[0];
      const item = variation.items[0];
      // Money.zero() クリアではなく解決済み単価が入る（不変則 単価=f(宛先,商品,年月日) の回復）
      expect(item.unitPrice.majorUnits).toBe(800);
      // 固定値引（明細・全体）は複製先で付与しない（クリア）
      expect(item.itemDiscount.isZero()).toBe(true);
      expect(variation.overallDiscount.isZero()).toBe(true);
    });

    it("解決済み単価マップに該当キーが無い場合は BusinessRuleViolationError（黙って0円にしない）", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      expect(() =>
        EstimateDuplicationService.duplicate({
          source,
          selectedVariationIds: [ids[0]],
          ...context(source),
          // 空マップ = 解決済み単価が供給されていない
          resolvedUnitPrices: new Map(),
        })
      ).toThrow(BusinessRuleViolationError);
    });

    it("率（discountRate）と品目・数量・メモは継承する", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [ids[0]],
        ...context(source),
      });

      const variation = estimate.variations[0];
      const item = variation.items[0];
      expect(item.discountRate.value).toBe(0.95);
      expect(item.itemName.value).toBe("商品A");
      expect(item.quantity.value).toBe(2);
      expect(item.customerMemo.value).toBe("明細メモ");
      expect(variation.customerMemo.value).toBe("バリエーション1メモ");
    });

    it("提出区分は複製元バリエーション単位で継承する（ADR-0045 / §5.3）", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      // 逆順に選択しても、各複製先は自分の複製元の提出区分を引き継ぐ
      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [ids[1], ids[0]],
        ...context(source),
      });

      // 1 番目の複製先 = 複製元 ids[1]（得意先宛）、2 番目 = ids[0]（納品先宛）
      expect(estimate.variations[0].submissionType.isCustomer()).toBe(true);
      expect(estimate.variations[1].submissionType.isDeliveryLocation()).toBe(true);
    });

    it("複製先バリエーションはすべて有効（ACTIVE）になる", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: ids,
        ...context(source),
      });

      for (const variation of estimate.variations) {
        expect(variation.status.value).toBe("ACTIVE");
      }
    });

    it("系譜は複製先 id ↔ 複製元 id を選択順でペア化する", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      const { estimate, copies } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [ids[1], ids[0]],
        ...context(source),
      });

      expect(copies).toHaveLength(2);
      expect(copies[0].sourceVariationId.equals(ids[1])).toBe(true);
      expect(copies[0].copiedVariationId.equals(estimate.variations[0].id)).toBe(true);
      expect(copies[1].sourceVariationId.equals(ids[0])).toBe(true);
    });

    it("複製元は一切変更されない（単価・バリエーション数）", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [ids[0]],
        ...context(source),
      });

      expect(source.variations).toHaveLength(2);
      expect(source.variations[0].items[0].unitPrice.majorUnits).toBe(1000);
    });
  });

  describe("duplicate() - セット群の引き継ぎ（#602・ADR-20260714-k2m）", () => {
    it("セット群が群ごと引き継がれ、構成明細は新しい実体として群に配線される", () => {
      const source = buildSourceWithSetGroup();
      const sourceVariation = source.variations[0];
      const sourceGroup = sourceVariation.setGroups[0];

      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [sourceVariation.id],
        ...context(source),
      });

      const copied = estimate.variations[0];
      expect(copied.setGroups).toHaveLength(1);
      const copiedGroup = copied.setGroups[0];

      // 群は新採番され、構成明細も新実体になる（複製元の id を指してはならない）
      expect(copiedGroup.id.equals(sourceGroup.id)).toBe(false);
      const sourceComponentIds = sourceVariation.lineStructure.setGroups[0].components.map(
        (c) => c.id
      );
      for (const memberId of copiedGroup.memberItemIds) {
        expect(sourceComponentIds.some((id) => id.equals(memberId))).toBe(false);
      }

      // 群のスナップショット属性・メモは複製元から複写する
      expect(copiedGroup.productId.value).toBe(SET_PRODUCT_UUID);
      expect(copiedGroup.itemName.value).toBe("セット商品X");
      expect(copiedGroup.unit.value).toBe("式");
      expect(copiedGroup.customerMemo.value).toBe("群の顧客メモ");
      expect(copiedGroup.internalMemo.value).toBe("群の社内メモ");

      // 構成明細は複製先の items に同居し、通常明細は群に吸い込まれない
      const structure = copied.lineStructure;
      expect(structure.normalItems.map((i) => i.itemName.value)).toEqual(["通常明細"]);
      expect(structure.setGroups[0].components.map((c) => c.itemName.value)).toEqual([
        "構成1",
        "構成2",
      ]);
    });

    it("構成明細にも通常明細と同じ変換規則（単価は提出区分×商品IDで解決・掛率継承・固定値引クリア）が適用される", () => {
      const source = buildSourceWithSetGroup();
      const sourceVariation = source.variations[0];

      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [sourceVariation.id],
        ...context(source),
      });

      const [component1] = estimate.variations[0].lineStructure.setGroups[0].components;
      // 単価は複製元単価（1000）の複写ではなく、解決済みマップの値（800）
      expect(component1.unitPrice.majorUnits).toBe(800);
      expect(component1.quantity.value).toBe(2);
      expect(component1.sortOrder).toBe(1);
      expect(component1.discountRate.value).toBe(0.9);
      expect(component1.itemDiscount.isZero()).toBe(true);
      expect(component1.customerMemo.value).toBe("構成1メモ");
      // 複製先は改訂ではないため粗利スナップショットを持たない
      expect(component1.revisedDetail).toBeNull();
    });

    it("構成明細の単価が複製元の提出区分で解決されていないと BusinessRuleViolationError", () => {
      const source = buildSourceWithSetGroup();
      const sourceVariation = source.variations[0];
      // 通常明細だけ解決し、構成明細の商品を落としたマップ（キーは 提出区分:商品ID）
      const partial = new Map([
        [duplicatedUnitPriceKey(sourceVariation.submissionType, UUID), Money.fromMajorUnits(800)],
      ]);

      expect(() =>
        EstimateDuplicationService.duplicate({
          source,
          selectedVariationIds: [sourceVariation.id],
          ...context(source),
          resolvedUnitPrices: partial,
        })
      ).toThrow(BusinessRuleViolationError);
    });
  });

  describe("duplicate() - 継承（修理詳細）", () => {
    it("REPAIR 複製元の修理詳細を複製先へ引き継ぐ", () => {
      const source = EstimateFactory.create({
        estimateNumber: EstimateNumber.parse("R2500001"),
        estimateDate: new Date("2025-04-01T00:00:00.000Z"),
        deadline: new Date("2025-04-30T00:00:00.000Z"),
        customerId: new CustomerId(UUID),
        deliveryLocationId: new DeliveryLocationId(UUID),
        taxRate: new TaxRate(0.1),
        taxRoundingType: TaxRoundingType.ROUND_DOWN,
        createdBy: new EmployeeId(UUID),
        departmentId: new DepartmentId(UUID),
        variations: [
          {
            setGroups: [],
            variationNumber: 1,
            submissionType: SubmissionType.CUSTOMER,
            items: [
              {
                productId: new ProductId(UUID),
                sortOrder: 1,
                itemName: new ItemName("商品A"),
                quantity: new Quantity(1),
                unit: new Unit("個"),
                unitPrice: Money.fromMajorUnits(1000),
              },
            ],
          },
        ],
        repairDetail: {
          targetProductId: new ProductId(UUID),
          faultDescription: new FaultDescription("電源が入らない"),
          scheduledRepairDate: new Date("2025-05-10T00:00:00.000Z"),
        },
      });

      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [source.variations[0].id],
        ...context(source, "R2500009"),
      });

      expect(estimate.estimateType.value).toBe("REPAIR");
      expect(estimate.repairDetail?.faultDescription.value).toBe("電源が入らない");
    });
  });

  describe("duplicate() - 異常系", () => {
    it("選択なし（空選択）は BusinessRuleViolationError（ADR-0042）", () => {
      const source = buildSourceNew();

      expect(() =>
        EstimateDuplicationService.duplicate({
          source,
          selectedVariationIds: [],
          ...context(source),
        })
      ).toThrow(BusinessRuleViolationError);
    });

    it("複製元に存在しないバリエーション id は BusinessRuleViolationError", () => {
      const source = buildSourceNew();

      expect(() =>
        EstimateDuplicationService.duplicate({
          source,
          selectedVariationIds: [EstimateVariationId.generate()],
          ...context(source),
        })
      ).toThrow(BusinessRuleViolationError);
    });
  });
});
