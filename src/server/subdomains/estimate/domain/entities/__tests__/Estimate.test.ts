import { ValidationError } from "@server/shared/errors/DomainError";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { EmergencyReason } from "../../values/EmergencyReason";
import { EstimateNumber } from "../../values/EstimateNumber";
import { FaultDescription } from "../../values/FaultDescription";
import { ItemName } from "../../values/ItemName";
import { Money } from "../../values/Money";
import { Quantity } from "../../values/Quantity";
import { SubmissionType } from "../../values/SubmissionType";
import { Unit } from "../../values/Unit";
import { TaxRate } from "../../values/TaxRate";
import { TaxRoundingType } from "../../values/TaxRoundingType";
import { AfterRepairEstimateDetail } from "../AfterRepairEstimateDetail";
import { Estimate } from "../Estimate";
import { EstimateItem } from "../EstimateItem";
import { EstimateVariation, type TaxContext } from "../EstimateVariation";
import { RepairEstimateDetail } from "../RepairEstimateDetail";

const TAX: TaxContext = {
  taxRate: new TaxRate(0.1),
  taxRoundingType: TaxRoundingType.ROUND_DOWN,
};

function makeItem(unitPrice = 1000, quantity = 1): EstimateItem {
  return EstimateItem.create({
    productId: ProductId.generate(),
    sortOrder: 1,
    itemName: new ItemName("テスト商品"),
    quantity: new Quantity(quantity),
    unit: new Unit("個"),
    unitPrice: Money.fromMajorUnits(unitPrice),
  });
}

function makeVariation(variationNumber = 1, items?: EstimateItem[]): EstimateVariation {
  return EstimateVariation.create({
    variationNumber,
    tax: TAX,
    items: items ?? [makeItem()],
  });
}

function commonHeader() {
  return {
    estimateDate: new Date("2025-04-01"),
    deadline: new Date("2025-04-30"),
    submissionType: SubmissionType.CUSTOMER,
    customerId: CustomerId.generate(),
    deliveryLocationId: DeliveryLocationId.generate(),
    taxRate: TAX.taxRate,
    taxRoundingType: TAX.taxRoundingType,
    createdBy: EmployeeId.generate(),
    departmentId: DepartmentId.generate(),
  };
}

describe("Estimate", () => {
  describe("create() - 不変条件チェック", () => {
    it("最低 1 バリエーションで作成できる（NEW）", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [makeVariation()],
      });
      expect(e.estimateType.value).toBe("NEW");
      expect(e.variations).toHaveLength(1);
    });

    it("バリエーション 0 つだとエラー（§C1 空見積不可）", () => {
      expect(() =>
        Estimate.create({
          ...commonHeader(),
          estimateNumber: EstimateNumber.parse("N2500001"),
          variations: [],
        })
      ).toThrow("最低 1");
    });

    it("variationNumber 重複はエラー", () => {
      expect(() =>
        Estimate.create({
          ...commonHeader(),
          estimateNumber: EstimateNumber.parse("N2500001"),
          variations: [makeVariation(1), makeVariation(1)],
        })
      ).toThrow(ValidationError);
    });

    describe("ADR-0019 サブタイプ整合", () => {
      it("NEW に repairDetail を渡すとエラー", () => {
        expect(() =>
          Estimate.create({
            ...commonHeader(),
            estimateNumber: EstimateNumber.parse("N2500001"),
            variations: [makeVariation()],
            repairDetail: RepairEstimateDetail.create({
              targetProductId: ProductId.generate(),
              faultDescription: new FaultDescription("故障"),
              scheduledRepairDate: new Date(),
            }),
          })
        ).toThrow("estimateType=NEW");
      });

      it("REPAIR で repairDetail が未指定だとエラー", () => {
        expect(() =>
          Estimate.create({
            ...commonHeader(),
            estimateNumber: EstimateNumber.parse("R2500001"),
            variations: [makeVariation()],
          })
        ).toThrow("estimateType=REPAIR の見積は事前修理見積詳細が必須");
      });

      it("REPAIR で正しい詳細を渡すと成功", () => {
        const e = Estimate.create({
          ...commonHeader(),
          estimateNumber: EstimateNumber.parse("R2500001"),
          variations: [makeVariation()],
          repairDetail: RepairEstimateDetail.create({
            targetProductId: ProductId.generate(),
            faultDescription: new FaultDescription("故障"),
            scheduledRepairDate: new Date(),
          }),
        });
        expect(e.repairDetail).not.toBeNull();
        expect(e.afterRepairDetail).toBeNull();
      });

      it("AFTER_REPAIR で afterRepairDetail が未指定だとエラー", () => {
        expect(() =>
          Estimate.create({
            ...commonHeader(),
            estimateNumber: EstimateNumber.parse("A2500001"),
            variations: [makeVariation()],
          })
        ).toThrow("estimateType=AFTER_REPAIR の見積は事後修理見積詳細が必須");
      });

      it("AFTER_REPAIR で正しい詳細を渡すと成功", () => {
        const e = Estimate.create({
          ...commonHeader(),
          estimateNumber: EstimateNumber.parse("A2500001"),
          variations: [makeVariation()],
          afterRepairDetail: AfterRepairEstimateDetail.create({
            targetProductId: ProductId.generate(),
            faultDescription: new FaultDescription("故障"),
            actualRepairDate: new Date(),
            emergencyReason: new EmergencyReason("緊急"),
          }),
        });
        expect(e.afterRepairDetail).not.toBeNull();
        expect(e.repairDetail).toBeNull();
      });

      it("REPAIR に afterRepairDetail を同時に付けるとエラー", () => {
        expect(() =>
          Estimate.create({
            ...commonHeader(),
            estimateNumber: EstimateNumber.parse("R2500001"),
            variations: [makeVariation()],
            repairDetail: RepairEstimateDetail.create({
              targetProductId: ProductId.generate(),
              faultDescription: new FaultDescription("故障"),
              scheduledRepairDate: new Date(),
            }),
            afterRepairDetail: AfterRepairEstimateDetail.create({
              targetProductId: ProductId.generate(),
              faultDescription: new FaultDescription("故障"),
              actualRepairDate: new Date(),
              emergencyReason: new EmergencyReason("緊急"),
            }),
          })
        ).toThrow("事後修理見積詳細を持てません");
      });
    });
  });

  describe("派生ゲッター（EstimateNumber 経由）", () => {
    it("estimateType は estimateNumber から派生", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("R2500042"),
        variations: [makeVariation()],
        repairDetail: RepairEstimateDetail.create({
          targetProductId: ProductId.generate(),
          faultDescription: new FaultDescription("故障"),
          scheduledRepairDate: new Date(),
        }),
      });
      expect(e.estimateType.value).toBe("REPAIR");
      expect(e.fiscalYear.value).toBe(2025);
      expect(e.sequence).toBe(42);
    });
  });

  describe("バリエーション操作", () => {
    function makeEstimate() {
      return Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [makeVariation(1)],
      });
    }

    it("addVariation で追加できる", () => {
      const e = makeEstimate();
      e.addVariation(makeVariation(2));
      expect(e.variations).toHaveLength(2);
    });

    it("addVariation で番号重複はエラー", () => {
      const e = makeEstimate();
      expect(() => e.addVariation(makeVariation(1))).toThrow("重複");
    });

    it("removeVariation で削除できる", () => {
      const e = makeEstimate();
      const v2 = makeVariation(2);
      e.addVariation(v2);
      e.removeVariation(v2.id);
      expect(e.variations).toHaveLength(1);
    });

    it("最後の 1 つは削除できない（§C1）", () => {
      const e = makeEstimate();
      const onlyId = e.variations[0].id;
      expect(() => e.removeVariation(onlyId)).toThrow("最後のバリエーション");
    });

    it("activate/deactivate", () => {
      const e = makeEstimate();
      const id = e.variations[0].id;
      e.deactivateVariation(id);
      expect(e.variations[0].isActive()).toBe(false);
      e.activateVariation(id);
      expect(e.variations[0].isActive()).toBe(true);
    });
  });

  describe("明細操作（集約境界 → ルート経由のみ）", () => {
    function makeEstimateWithEmptyV() {
      return Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [EstimateVariation.create({ variationNumber: 1, tax: TAX, items: [] })],
      });
    }

    it("addItem で variation の集計が再計算される", () => {
      const e = makeEstimateWithEmptyV();
      const vId = e.variations[0].id;
      expect(e.variations[0].finalTotal.isZero()).toBe(true);

      e.addItem(vId, makeItem(1000));

      expect(e.variations[0].subtotal.equals(Money.fromMajorUnits(1000))).toBe(true);
      expect(e.variations[0].finalTotal.equals(Money.fromMajorUnits(1100))).toBe(true);
    });

    it("changeItemQuantity で集計が再計算される（ルート → variation 委譲）", () => {
      const item = makeItem(1000, 1);
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [EstimateVariation.create({ variationNumber: 1, tax: TAX, items: [item] })],
      });
      const vId = e.variations[0].id;

      e.changeItemQuantity(vId, item.id, new Quantity(3));

      expect(e.variations[0].subtotal.equals(Money.fromMajorUnits(3000))).toBe(true);
    });

    it("存在しない variationId はエラー", () => {
      const e = makeEstimateWithEmptyV();
      const fakeVid = EstimateVariation.create({ variationNumber: 99, tax: TAX }).id;
      expect(() => e.addItem(fakeVid, makeItem())).toThrow("バリエーションは存在しません");
    });
  });

  describe("税情報変更 → 全 variation に伝播", () => {
    it("changeTaxRate で全 variation の taxAmount が再計算される", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [
          EstimateVariation.create({ variationNumber: 1, tax: TAX, items: [makeItem(1000)] }),
          EstimateVariation.create({ variationNumber: 2, tax: TAX, items: [makeItem(2000)] }),
        ],
      });
      // 初期: 税率 10% → taxAmount 各 100 / 200
      expect(e.variations[0].taxAmount.equals(Money.fromMajorUnits(100))).toBe(true);
      expect(e.variations[1].taxAmount.equals(Money.fromMajorUnits(200))).toBe(true);

      e.changeTaxRate(new TaxRate(0.05));

      // 5%: 各 50 / 100
      expect(e.variations[0].taxAmount.equals(Money.fromMajorUnits(50))).toBe(true);
      expect(e.variations[1].taxAmount.equals(Money.fromMajorUnits(100))).toBe(true);
    });
  });

  describe("サブタイプ詳細の付け替え", () => {
    it("NEW に attachRepairDetail はエラー", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [makeVariation()],
      });
      expect(() =>
        e.attachRepairDetail(
          RepairEstimateDetail.create({
            targetProductId: ProductId.generate(),
            faultDescription: new FaultDescription("故障"),
            scheduledRepairDate: new Date(),
          })
        )
      ).toThrow("estimateType=REPAIR の見積にしか");
    });

    it("REPAIR では detachRepairDetail できない", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("R2500001"),
        variations: [makeVariation()],
        repairDetail: RepairEstimateDetail.create({
          targetProductId: ProductId.generate(),
          faultDescription: new FaultDescription("故障"),
          scheduledRepairDate: new Date(),
        }),
      });
      expect(() => e.detachRepairDetail()).toThrow("外せません");
    });
  });
});
