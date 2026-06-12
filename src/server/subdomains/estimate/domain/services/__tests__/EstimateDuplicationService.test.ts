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
import { Money } from "../../values/Money";
import { Quantity } from "../../values/Quantity";
import { SubmissionType } from "../../values/SubmissionType";
import { TaxRate } from "../../values/TaxRate";
import { TaxRoundingType } from "../../values/TaxRoundingType";
import { Unit } from "../../values/Unit";
import { EstimateDuplicationService } from "../EstimateDuplicationService";

const UUID = "00000000-0000-7000-8000-000000000001";

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

function context(estimateNumber = "N2500099") {
  return {
    estimateNumber: EstimateNumber.parse(estimateNumber),
    estimateDate: new Date("2025-06-01T00:00:00.000Z"),
    deadline: new Date("2025-06-30T00:00:00.000Z"),
    taxRate: new TaxRate(0.1),
    createdBy: new EmployeeId(UUID),
    departmentId: new DepartmentId(UUID),
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
        ...context(),
      });

      expect(estimate.variations).toHaveLength(2);
      expect(estimate.variations[0].variationNumber).toBe(1);
      expect(estimate.variations[1].variationNumber).toBe(2);
      // 1 番目（複製先）は複製元 ids[1]（商品B）由来
      expect(estimate.variations[0].items[0].itemName.value).toBe("商品B");
    });

    it("単価は 0 にクリアし、固定値引（明細・全体）もクリアする", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [ids[0]],
        ...context(),
      });

      const variation = estimate.variations[0];
      const item = variation.items[0];
      expect(item.unitPrice.isZero()).toBe(true);
      expect(item.itemDiscount.isZero()).toBe(true);
      expect(variation.overallDiscount.isZero()).toBe(true);
      // 単価0なので金額は 0
      expect(variation.subtotal.isZero()).toBe(true);
    });

    it("率（discountRate）と品目・数量・メモは継承する", () => {
      const source = buildSourceNew();
      const ids = source.variations.map((v) => v.id);

      const { estimate } = EstimateDuplicationService.duplicate({
        source,
        selectedVariationIds: [ids[0]],
        ...context(),
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
        ...context(),
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
        ...context(),
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
        ...context(),
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
        ...context(),
      });

      expect(source.variations).toHaveLength(2);
      expect(source.variations[0].items[0].unitPrice.majorUnits).toBe(1000);
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
        ...context("R2500009"),
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
          ...context(),
        })
      ).toThrow(BusinessRuleViolationError);
    });

    it("複製元に存在しないバリエーション id は BusinessRuleViolationError", () => {
      const source = buildSourceNew();

      expect(() =>
        EstimateDuplicationService.duplicate({
          source,
          selectedVariationIds: [EstimateVariationId.generate()],
          ...context(),
        })
      ).toThrow(BusinessRuleViolationError);
    });
  });
});
